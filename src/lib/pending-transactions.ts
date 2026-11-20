/**
 * Pending-transaction store, reload/reconnect retry idempotency, and network
 * reconciliation (#1143, #1287).
 *
 * Security & idempotency invariants:
 * - A transaction handed to the network (`submitted` / `confirming`) has an
 *   unknown outcome until RPC reports a terminal verdict (`confirmed` or
 *   `failed`). Local state is never authoritative for settlement.
 * - Reloading the page or reconnecting a wallet restores persisted entries
 *   from {@link PENDING_TRANSACTIONS_STORAGE_KEY}.
 * - Operation-level idempotency: callers identify a financial action with an
 *   `operationKey` (or fall back to `address + label`). While any entry with
 *   the same operation key remains unsettled in storage,
 *   {@link checkSubmissionIdempotency} and {@link assertOperationNotPending}
 *   block duplicate submissions (`resubmitSafe: false`) so reload/reconnect
 *   retries cannot broadcast a second transaction for the same operation.
 * - Only network reconciliation ({@link reconcilePendingTransactions}) or an
 *   explicit terminal settlement ({@link removePendingTransaction}) releases
 *   an operation lock. Unreachable RPCs preserve all entries unchanged.
 */

import {
  auditPendingTransactionsStorage,
  PENDING_TRANSACTION_TTL_MS,
  sanitizePendingTransactionRecord,
} from '../utils/walletStorage';

export type PendingTransactionStatus = 'submitted' | 'confirming';

export interface PendingTransaction {
  /** Stellar transaction hash returned by `sendTransaction`. */
  hash: string;
  /** Human label for toasts / debugging (e.g. `fund_invoice:42`). */
  label?: string;
  /**
   * Stable idempotency key for the logical financial operation (for example
   * `fund_invoice:42` or `settle_invoice:42:full`). When omitted on legacy v1
   * entries, derived from `address` + `label` if `label` is present (#1287).
   */
  operationKey?: string;
  /** Submitting wallet address, when known. */
  address?: string;
  /** Epoch ms when the entry was recorded. */
  createdAt: number;
  /** Epoch ms of the most recent network reconciliation attempt. */
  lastCheckedAt?: number;
  status: PendingTransactionStatus;
}

export type SettledTransactionStatus = 'confirmed' | 'failed' | 'confirming';

export const PENDING_TRANSACTIONS_STORAGE_KEY = 'iln_pending_transactions_v1';

/** Cap so a pathological session cannot grow the entry unboundedly. */
const MAX_PENDING_TRANSACTIONS = 25;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Thrown when a caller attempts to submit a financial operation whose previous
 * submission is still unsettled in local storage after a reload or reconnect
 * (#1287). Carries the existing transaction hash and marks `resubmitSafe: false`.
 */
export class DuplicatePendingOperationError extends Error {
  readonly code = 'DUPLICATE_PENDING_OPERATION' as const;
  readonly operationKey: string;
  readonly existingHash: string;
  readonly resubmitSafe = false as const;

  constructor(operationKey: string, existingHash: string) {
    super(
      `Operation "${operationKey}" already has an unsettled transaction (${existingHash}). ` +
        'Reconcile its network status before submitting again.'
    );
    this.name = 'DuplicatePendingOperationError';
    this.operationKey = operationKey;
    this.existingHash = existingHash;
  }
}

export interface SubmissionIdempotencyCheck {
  allowed: boolean;
  reason?: 'pending_operation_in_flight';
  existing?: PendingTransaction;
}

function safeStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    return null;
  }
  return null;
}

/**
 * Normalize or derive the canonical operation key for idempotency checks (#1287).
 *
 * Returns `null` only when neither `operationKey` nor `label` is supplied, so
 * legacy hash-only records remain backward compatible while labeled financial
 * operations are automatically protected against duplicate retries.
 */
export function deriveOperationKey(
  input: Pick<PendingTransaction, 'operationKey' | 'label' | 'address'>
): string | null {
  const explicit = input.operationKey?.trim();
  if (explicit) return explicit;
  const label = input.label?.trim();
  if (!label) return null;
  const addr = input.address?.trim();
  return addr ? `${addr}:${label}` : label;
}

function readEntries(storage?: StorageLike): PendingTransaction[] {
  const store = safeStorage(storage);
  if (!store) return [];
  const audited = auditPendingTransactionsStorage(store, {
    ttlMs: PENDING_TRANSACTION_TTL_MS,
    persistCleanup: true,
  });
  return audited.valid;
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
 * Look up an unsettled pending transaction matching `operationKey` (either by
 * explicit `operationKey` or by the derived key on legacy v1 records, #1287).
 */
export function findPendingOperation(
  operationKey: string,
  storage?: StorageLike
): PendingTransaction | undefined {
  const normalized = operationKey.trim();
  if (!normalized) return undefined;
  return readEntries(storage).find((entry) => deriveOperationKey(entry) === normalized);
}

/** True when a logical financial operation already has an unsettled transaction. */
export function hasPendingOperation(operationKey: string, storage?: StorageLike): boolean {
  return findPendingOperation(operationKey, storage) !== undefined;
}

/**
 * Guard called before building/submitting a financial transaction after reload
 * or reconnect (#1287). Never permits a duplicate submission while an existing
 * transaction for the same operation key has an unknown/unsettled outcome.
 */
export function checkSubmissionIdempotency(
  operationKey: string,
  storage?: StorageLike
): SubmissionIdempotencyCheck {
  const existing = findPendingOperation(operationKey, storage);
  if (existing) {
    return {
      allowed: false,
      reason: 'pending_operation_in_flight',
      existing,
    };
  }
  return { allowed: true };
}

/**
 * Fail-closed assertion that throws {@link DuplicatePendingOperationError} when
 * the given financial operation already has an unsettled transaction persisted
 * in storage (#1287).
 */
export function assertOperationNotPending(operationKey: string, storage?: StorageLike): void {
  const check = checkSubmissionIdempotency(operationKey, storage);
  if (!check.allowed && check.existing) {
    throw new DuplicatePendingOperationError(operationKey, check.existing.hash);
  }
}

/**
 * Record a hash handed to the network. Deduplicates by hash and by canonical
 * operation key so retry, reload, and reconnect paths can never create
 * duplicate pending entries for the same financial operation (#1143, #1287).
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

  const opKey = deriveOperationKey(entry);
  if (opKey && entries.some((existing) => deriveOperationKey(existing) === opKey)) {
    return entries;
  }

  const candidate: PendingTransaction = {
    hash: entry.hash,
    ...(entry.label !== undefined ? { label: entry.label } : {}),
    ...(opKey ? { operationKey: opKey } : {}),
    ...(entry.address !== undefined ? { address: entry.address } : {}),
    createdAt: entry.createdAt ?? Date.now(),
    ...(entry.lastCheckedAt !== undefined ? { lastCheckedAt: entry.lastCheckedAt } : {}),
    status: entry.status ?? 'submitted',
  };
  const sanitized = sanitizePendingTransactionRecord(candidate);
  if (sanitized.status !== 'valid') {
    return entries;
  }
  const updated = [sanitized.record, ...entries].slice(0, MAX_PENDING_TRANSACTIONS);
  writeEntries(updated, storage);
  return updated;
}

/** All locally-known unsettled submissions (never authoritative on its own). */
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
  /** Hashes still unsettled on the network (kept for the next pass). */
  stillPending: string[];
}

const inFlightReconciliations = new WeakMap<StorageLike, Promise<ReconciliationSummary>>();

async function runReconciliation(
  fetchStatus: (hash: string) => Promise<SettledTransactionStatus>,
  storage?: StorageLike
): Promise<ReconciliationSummary> {
  const entries = readEntries(storage);
  const summary: ReconciliationSummary = { confirmed: [], failed: [], stillPending: [] };
  const checkedAt = Date.now();

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
      const current = readEntries(storage).map((item) =>
        item.hash === entry.hash
          ? { ...item, status: 'confirming' as const, lastCheckedAt: checkedAt }
          : item
      );
      writeEntries(current, storage);
    }
  }

  return summary;
}

/**
 * Refresh every pending entry from network truth.
 *
 * The `fetchStatus` callback must query the network (e.g. RPC
 * `getTransaction`) — local state is never used to mark anything settled.
 * Entries the network reports as `confirmed` / `failed` are removed; anything
 * still `confirming` (or unreachable) is kept untouched. Concurrent calls over
 * the same storage instance coalesce so overlapping mount/reconnect passes do
 * not race or duplicate RPC lookups (#1287).
 */
export async function reconcilePendingTransactions(
  fetchStatus: (hash: string) => Promise<SettledTransactionStatus>,
  storage?: StorageLike
): Promise<ReconciliationSummary> {
  const store = safeStorage(storage);
  if (!store) {
    return runReconciliation(fetchStatus, storage);
  }
  const active = inFlightReconciliations.get(store);
  if (active) {
    return active;
  }
  const pass = runReconciliation(fetchStatus, store).finally(() => {
    inFlightReconciliations.delete(store);
  });
  inFlightReconciliations.set(store, pass);
  return pass;
}
