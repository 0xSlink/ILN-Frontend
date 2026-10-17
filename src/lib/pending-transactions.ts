/**
 * Pending-transaction store + network reconciliation (#1143).
 *
 * A transaction that has been handed to the network (`submitted`) may still be
 * `confirming` when the user reloads the page or the wallet reconnects. The
 * local pending entry is never authoritative — it only records "we sent hash H
 * and have not seen its settlement yet". {@link reconcilePendingTransactions}
 * refreshes every entry from RPC network truth and drops whatever the network
 * reports as settled, so stale `submitted` / `confirming` state cannot linger
 * (or be re-submitted) after a reconnect or reload.
 */

export type PendingTransactionStatus = 'submitted' | 'confirming';

export interface PendingTransaction {
  /** Stellar transaction hash returned by `sendTransaction`. */
  hash: string;
  /** Human label for toasts / debugging (e.g. `fund_invoice:42`). */
  label?: string;
  /** Submitting wallet address, when known. */
  address?: string;
  /** Epoch ms when the entry was recorded. */
  createdAt: number;
  status: PendingTransactionStatus;
}

export type SettledTransactionStatus = 'confirmed' | 'failed' | 'confirming';

export const PENDING_TRANSACTIONS_STORAGE_KEY = 'iln_pending_transactions_v1';

/** Cap so a pathological session cannot grow the entry unboundedly. */
const MAX_PENDING_TRANSACTIONS = 25;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function safeStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    return null;
  }
  return null;
}

function readEntries(storage?: StorageLike): PendingTransaction[] {
  const store = safeStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(PENDING_TRANSACTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PendingTransaction =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as PendingTransaction).hash === 'string' &&
        (entry as PendingTransaction).hash.length > 0
    );
  } catch {
    return [];
  }
}

function writeEntries(entries: PendingTransaction[], storage?: StorageLike): void {
  const store = safeStorage(storage);
  if (!store) return;
  try {
    store.setItem(PENDING_TRANSACTIONS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full / unavailable: pending tracking degrades silently rather
    // than breaking the submit flow.
  }
}

/**
 * Record a hash handed to the network. Deduplicates by hash so retry and
 * reconnect paths can never create a duplicate pending entry (and therefore
 * never trigger a duplicate submission).
 */
export function recordPendingTransaction(
  entry: Omit<PendingTransaction, 'createdAt' | 'status'> & {
    createdAt?: number;
    status?: PendingTransactionStatus;
  },
  storage?: StorageLike
): PendingTransaction[] {
  const entries = readEntries(storage);
  if (entries.some((existing) => existing.hash === entry.hash)) return entries;
  const next: PendingTransaction = {
    ...entry,
    createdAt: entry.createdAt ?? Date.now(),
    status: entry.status ?? 'submitted',
  };
  const updated = [next, ...entries].slice(0, MAX_PENDING_TRANSACTIONS);
  writeEntries(updated, storage);
  return updated;
}

/** All locally-known un settled submissions (never authoritative on its own). */
export function getPendingTransactions(storage?: StorageLike): PendingTransaction[] {
  return readEntries(storage);
}

/** Drop one entry (settled, superseded, or explicitly dismissed). */
export function removePendingTransaction(
  hash: string,
  storage?: StorageLike
): PendingTransaction[] {
  const updated = readEntries(storage).filter((entry) => entry.hash !== hash);
  writeEntries(updated, storage);
  return updated;
}

export interface ReconciliationSummary {
  /** Hashes the network reports as successfully settled. */
  confirmed: string[];
  /** Hashes the network reports as failed. */
  failed: string[];
  /** Hashes still un settled on the network (kept for the next pass). */
  stillPending: string[];
}

/**
 * Refresh every pending entry from network truth.
 *
 * The `fetchStatus` callback must query the network (e.g. RPC
 * `getTransaction`) — local state is never used to mark anything settled.
 * Entries the network reports as `confirmed` / `failed` are removed; anything
 * still `confirming` (or unreachable) is kept untouched.
 */
export async function reconcilePendingTransactions(
  fetchStatus: (hash: string) => Promise<SettledTransactionStatus>,
  storage?: StorageLike
): Promise<ReconciliationSummary> {
  const entries = readEntries(storage);
  const summary: ReconciliationSummary = { confirmed: [], failed: [], stillPending: [] };

  for (const entry of entries) {
    let status: SettledTransactionStatus;
    try {
      status = await fetchStatus(entry.hash);
    } catch {
      // Network unreachable: keep the entry so a later pass can reconcile it.
      summary.stillPending.push(entry.hash);
      continue;
    }
    if (status === 'confirmed') {
      summary.confirmed.push(entry.hash);
      removePendingTransaction(entry.hash, storage);
    } else if (status === 'failed') {
      summary.failed.push(entry.hash);
      removePendingTransaction(entry.hash, storage);
    } else {
      summary.stillPending.push(entry.hash);
    }
  }

  return summary;
}
