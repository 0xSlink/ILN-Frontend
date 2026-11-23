/**
 * Pending-transaction store, reload/reconnect idempotency, and reconciliation
 * tests for #1143 and #1287.
 *
 * - Recording deduplicates by hash AND by canonical operation key so reload /
 *   reconnect retries cannot create duplicate pending financial operations.
 * - `checkSubmissionIdempotency` / `assertOperationNotPending` block duplicate
 *   submissions across reload until network reconciliation settles the entry.
 * - Reconciliation removes only what the network reports settled, coalesces
 *   concurrent passes, and keeps everything else on unreachable RPCs.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  assertOperationNotPending,
  checkSubmissionIdempotency,
  deriveOperationKey,
  DuplicatePendingOperationError,
  findPendingOperation,
  getPendingTransactions,
  hasPendingOperation,
  recordPendingTransaction,
  reconcilePendingTransactions,
  removePendingTransaction,
  PENDING_TRANSACTIONS_STORAGE_KEY,
  type SettledTransactionStatus,
} from '../pending-transactions';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

let storage: Storage;

beforeEach(() => {
  storage = memoryStorage();
});

describe('pending transaction store', () => {
  it('records and reads back entries', () => {
    recordPendingTransaction({ hash: 'abc', label: 'fund_invoice:1' }, storage);
    const entries = getPendingTransactions(storage);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      hash: 'abc',
      status: 'submitted',
      operationKey: 'fund_invoice:1',
    });
  });

  it('deduplicates by hash so retry/reconnect cannot duplicate', () => {
    recordPendingTransaction({ hash: 'abc' }, storage);
    recordPendingTransaction({ hash: 'abc' }, storage);
    recordPendingTransaction({ hash: 'abc' }, storage);
    expect(getPendingTransactions(storage)).toHaveLength(1);
  });

  it('deduplicates by operation key so a different hash cannot shadow an in-flight financial op (#1287)', () => {
    recordPendingTransaction(
      { hash: 'hash-1', label: 'fund_invoice:42', address: 'GALICE' },
      storage
    );
    recordPendingTransaction(
      { hash: 'hash-2', label: 'fund_invoice:42', address: 'GALICE' },
      storage
    );
    const entries = getPendingTransactions(storage);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.hash).toBe('hash-1');
  });

  it('removes entries individually', () => {
    recordPendingTransaction({ hash: 'a' }, storage);
    recordPendingTransaction({ hash: 'b' }, storage);
    removePendingTransaction('a', storage);
    expect(getPendingTransactions(storage).map((e) => e.hash)).toEqual(['b']);
  });

  it('survives a reload via the stable storage key', () => {
    recordPendingTransaction({ hash: 'persist-me' }, storage);
    const raw = storage.getItem(PENDING_TRANSACTIONS_STORAGE_KEY);
    expect(raw).toContain('persist-me');
    // A fresh reader over the same storage (new page load) sees it.
    expect(getPendingTransactions(storage)).toHaveLength(1);
  });
});

describe('reload/reconnect retry idempotency (#1287)', () => {
  it('blocks duplicate submission for the same operation after reload until network settles', async () => {
    const opKey = deriveOperationKey({ label: 'fund_invoice:42', address: 'GLP1' })!;
    recordPendingTransaction(
      { hash: 'tx-original-hash', label: 'fund_invoice:42', address: 'GLP1' },
      storage
    );

    // Simulate reload: fresh check against persisted storage blocks blind retry.
    expect(hasPendingOperation(opKey, storage)).toBe(true);
    const check = checkSubmissionIdempotency(opKey, storage);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('pending_operation_in_flight');
    expect(check.existing?.hash).toBe('tx-original-hash');

    expect(() => assertOperationNotPending(opKey, storage)).toThrowError(
      DuplicatePendingOperationError
    );

    // Unreachable RPC keeps the lock active (fail-closed).
    await reconcilePendingTransactions(async () => {
      throw new Error('RPC timeout');
    }, storage);
    expect(checkSubmissionIdempotency(opKey, storage).allowed).toBe(false);

    // Still-confirming verdict keeps the lock active and marks status confirming.
    await reconcilePendingTransactions(async () => 'confirming', storage);
    expect(checkSubmissionIdempotency(opKey, storage).allowed).toBe(false);
    expect(findPendingOperation(opKey, storage)?.status).toBe('confirming');

    // Only a terminal network verdict releases the operation lock.
    await reconcilePendingTransactions(async () => 'failed', storage);
    expect(checkSubmissionIdempotency(opKey, storage).allowed).toBe(true);
    expect(() => assertOperationNotPending(opKey, storage)).not.toThrow();
  });

  it('stays backward-compatible with legacy v1 storage entries missing operationKey', () => {
    storage.setItem(
      PENDING_TRANSACTIONS_STORAGE_KEY,
      JSON.stringify([
        {
          hash: 'legacy-hash-99',
          label: 'settle_invoice:99',
          createdAt: Date.now() - 60_000,
          status: 'submitted',
        },
      ])
    );

    const check = checkSubmissionIdempotency('settle_invoice:99', storage);
    expect(check.allowed).toBe(false);
    expect(check.existing?.hash).toBe('legacy-hash-99');
  });
});

describe('reconcilePendingTransactions', () => {
  it('removes network-settled entries and keeps confirming ones', async () => {
    recordPendingTransaction({ hash: 'done' }, storage);
    recordPendingTransaction({ hash: 'bad' }, storage);
    recordPendingTransaction({ hash: 'waiting' }, storage);

    const fetchStatus = async (hash: string): Promise<SettledTransactionStatus> => {
      if (hash === 'done') return 'confirmed';
      if (hash === 'bad') return 'failed';
      return 'confirming';
    };

    const summary = await reconcilePendingTransactions(fetchStatus, storage);
    expect(summary).toEqual({ confirmed: ['done'], failed: ['bad'], stillPending: ['waiting'] });
    expect(getPendingTransactions(storage).map((e) => e.hash)).toEqual(['waiting']);
  });

  it('keeps every entry when the network is unreachable', async () => {
    recordPendingTransaction({ hash: 'a' }, storage);
    recordPendingTransaction({ hash: 'b' }, storage);

    const summary = await reconcilePendingTransactions(async () => {
      throw new Error('RPC down');
    }, storage);

    expect(summary.confirmed).toEqual([]);
    expect(summary.failed).toEqual([]);
    expect(summary.stillPending.sort()).toEqual(['a', 'b']);
    expect(getPendingTransactions(storage)).toHaveLength(2);
  });

  it('coalesces concurrent reconciliation passes over the same storage (#1287)', async () => {
    recordPendingTransaction({ hash: 'tx-concurrent' }, storage);
    let calls = 0;

    const fetchStatus = async (): Promise<SettledTransactionStatus> => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'confirmed';
    };

    const [a, b] = await Promise.all([
      reconcilePendingTransactions(fetchStatus, storage),
      reconcilePendingTransactions(fetchStatus, storage),
    ]);

    expect(calls).toBe(1);
    expect(a).toEqual(b);
    expect(a.confirmed).toEqual(['tx-concurrent']);
  });
});
