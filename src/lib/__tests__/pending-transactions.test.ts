/**
 * Pending-transaction store + reconciliation tests for #1143.
 *
 * - Recording deduplicates by hash (retry / reconnect cannot duplicate).
 * - Reconciliation removes only what the network reports settled and keeps
 *   everything else for the next pass (stale status always refreshes from
 *   network truth, never from local state).
 * - An unreachable network keeps all entries (no assumed verdicts).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPendingTransactions,
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
    expect(entries[0]).toMatchObject({ hash: 'abc', status: 'submitted' });
  });

  it('deduplicates by hash so retry/reconnect cannot duplicate', () => {
    recordPendingTransaction({ hash: 'abc' }, storage);
    recordPendingTransaction({ hash: 'abc' }, storage);
    recordPendingTransaction({ hash: 'abc' }, storage);
    expect(getPendingTransactions(storage)).toHaveLength(1);
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
});
