import { beforeEach, describe, expect, it } from 'vitest';
import {
  auditPendingTransactionsStorage,
  clearWalletStorage,
  containsSensitiveWalletData,
  PENDING_TRANSACTION_TTL_MS,
  PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY,
  sanitizePendingTransactionRecord,
  WALLET_ADDRESS_STORAGE_KEY,
  WALLET_SESSION_STORAGE_KEY,
} from '../walletStorage';
import {
  getPendingTransactions,
  recordPendingTransaction,
} from '../../lib/pending-transactions';

class InMemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const PUBLIC_ADDR = 'GBZXN7PIRZGNMHGA728R46MQ7ONLC3O3PNGGATUACCGWGL72WNZKSCGS';
const FAKE_SECRET_SEED = 'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const VALID_HASH = 'a'.repeat(64);
const VALID_HASH_2 = 'b'.repeat(64);

describe('walletStorage pending-transaction security audit (#1293)', () => {
  let storage: InMemoryStorage;
  const NOW = 1_750_000_000_000;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  it('detects Stellar secret seeds, JWT/Bearer tokens, emails, and raw XDR envelopes', () => {
    expect(containsSensitiveWalletData(FAKE_SECRET_SEED)).toBe(true);
    expect(containsSensitiveWalletData('Bearer secret-token-123')).toBe(true);
    expect(containsSensitiveWalletData('alice@example.com')).toBe(true);
    expect(containsSensitiveWalletData('A'.repeat(96))).toBe(true);
    expect(containsSensitiveWalletData('fund_invoice:42')).toBe(false);
    expect(containsSensitiveWalletData(PUBLIC_ADDR)).toBe(false);
  });

  it('strips unknown and sensitive fields while preserving valid minimal pending records', () => {
    const res = sanitizePendingTransactionRecord(
      {
        hash: VALID_HASH,
        label: 'fund_invoice:42',
        operationKey: 'fund_invoice:42',
        address: PUBLIC_ADDR,
        createdAt: NOW - 10_000,
        status: 'submitted',
        signedXdr: 'AAAAAgAAAAB...',
        envelopeXdr: 'AAAAAgAAAAC...',
        email: 'user@example.com',
        secretKey: FAKE_SECRET_SEED,
      },
      NOW
    );

    expect(res.status).toBe('valid');
    if (res.status === 'valid') {
      expect(res.sanitized).toBe(true);
      expect(res.strippedFields).toEqual(
        expect.arrayContaining(['signedXdr', 'envelopeXdr', 'email', 'secretKey'])
      );
      expect(res.record).toEqual({
        hash: VALID_HASH,
        label: 'fund_invoice:42',
        operationKey: 'fund_invoice:42',
        address: PUBLIC_ADDR,
        createdAt: NOW - 10_000,
        status: 'submitted',
      });
    }
  });

  it('rejects entries with secret-shaped hashes and scrubs secret seeds in address/label', () => {
    const badHash = sanitizePendingTransactionRecord(
      { hash: FAKE_SECRET_SEED, createdAt: NOW - 1000, status: 'submitted' },
      NOW
    );
    expect(badHash.status).toBe('rejected');

    const taintedFields = sanitizePendingTransactionRecord(
      {
        hash: VALID_HASH,
        address: FAKE_SECRET_SEED,
        label: 'invoice for alice@example.com',
        createdAt: NOW - 1000,
        status: 'submitted',
      },
      NOW
    );
    expect(taintedFields.status).toBe('valid');
    if (taintedFields.status === 'valid') {
      expect(taintedFields.record.address).toBeUndefined();
      expect(taintedFields.record.label).toBeUndefined();
      expect(taintedFields.strippedFields).toEqual(expect.arrayContaining(['address', 'label']));
    }
  });

  it('expires stale records past TTL and surfaces a clear recovery message', () => {
    storage.setItem(
      PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY,
      JSON.stringify([
        {
          hash: VALID_HASH,
          label: 'fund_invoice:1',
          createdAt: NOW - PENDING_TRANSACTION_TTL_MS - 1_000,
          status: 'submitted',
        },
        {
          hash: VALID_HASH_2,
          label: 'fund_invoice:2',
          createdAt: NOW - 60_000,
          status: 'confirming',
        },
      ])
    );

    const audit = auditPendingTransactionsStorage(storage, { now: NOW });
    expect(audit.expiredCount).toBe(1);
    expect(audit.valid).toHaveLength(1);
    expect(audit.valid[0].hash).toBe(VALID_HASH_2);
    expect(audit.recoveryMessage).toContain('1 expired pending transaction record');
    expect(audit.recoveryMessage).toContain('Stellar Explorer');

    // Repeated audit on cleaned storage is idempotent with no recovery warning.
    const second = auditPendingTransactionsStorage(storage, { now: NOW });
    expect(second.expiredCount).toBe(0);
    expect(second.valid).toHaveLength(1);
    expect(second.recoveryMessage).toBeNull();
  });

  it('recovers cleanly from corrupted pending transaction storage JSON', () => {
    storage.setItem(PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY, '{corrupt json');

    const audit = auditPendingTransactionsStorage(storage, { now: NOW });
    expect(audit.corrupted).toBe(true);
    expect(audit.valid).toEqual([]);
    expect(audit.recoveryMessage).toContain('Corrupted pending transaction storage was cleared');
    expect(storage.getItem(PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY)).toBeNull();
  });

  it('clearWalletStorage scrubs expired/sensitive pending records while preserving fresh unsettled locks by default', () => {
    const freshCreatedAt = Date.now() - 5_000;
    const staleCreatedAt = Date.now() - PENDING_TRANSACTION_TTL_MS - 5_000;
    storage.setItem(WALLET_ADDRESS_STORAGE_KEY, PUBLIC_ADDR);
    storage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify({ address: PUBLIC_ADDR }));
    storage.setItem(
      PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY,
      JSON.stringify([
        { hash: VALID_HASH, createdAt: staleCreatedAt, status: 'submitted' },
        {
          hash: VALID_HASH_2,
          address: PUBLIC_ADDR,
          createdAt: freshCreatedAt,
          status: 'submitted',
          signedXdr: 'AAAAAg==',
        },
      ])
    );

    clearWalletStorage(storage, { broadcast: false });

    expect(storage.getItem(WALLET_ADDRESS_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(WALLET_SESSION_STORAGE_KEY)).toBeNull();
    const remaining = JSON.parse(storage.getItem(PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY) || '[]');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].hash).toBe(VALID_HASH_2);
    expect(remaining[0].signedXdr).toBeUndefined();

    // Explicit opt-in clears all pending records as well.
    clearWalletStorage(storage, { broadcast: false, clearPendingTransactions: true });
    expect(storage.getItem(PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY)).toBeNull();
  });

  it('recordPendingTransaction never persists extra sensitive fields into storage', () => {
    const extra = {
      hash: VALID_HASH,
      label: 'fund_invoice:99',
      address: PUBLIC_ADDR,
      createdAt: Date.now() - 1000,
      signedXdr: 'AAAAAgAAAABsensitiveXdrPayload',
      email: 'private@example.com',
    } as Parameters<typeof recordPendingTransaction>[0];

    recordPendingTransaction(extra, storage);
    const stored = getPendingTransactions(storage);
    expect(stored).toHaveLength(1);
    expect((stored[0] as unknown as Record<string, unknown>).signedXdr).toBeUndefined();
    expect((stored[0] as unknown as Record<string, unknown>).email).toBeUndefined();
  });
});
