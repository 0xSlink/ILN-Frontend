/**
 * Wallet session storage cleanup & pending-transaction storage audit (#4, #1293).
 *
 * On disconnect we must drop every trace of the previous session: the stored
 * address plus any wallet-scoped caches (address book, watchlist, referral
 * attribution, cached invoice/portfolio data). Centralised here so disconnect
 * has a single, testable definition of "what counts as session data".
 *
 * Security audit invariants (#1293):
 * - Pending transaction persistence (`iln_pending_transactions_v1`) must store
 *   only minimal public reconciliation metadata (`hash`, `label`, `operationKey`,
 *   public `address`, `createdAt`, `lastCheckedAt`, `status`) — never secret
 *   seeds (`S...`), signed/unsigned XDR envelopes, bearer tokens, or PII.
 * - Pending records expire after {@link PENDING_TRANSACTION_TTL_MS} (24 hours)
 *   so stale or abandoned submissions never leave permanent retry locks and
 *   produce an actionable recovery message when cleared.
 * - Disconnect cleanup scrubs expired, malformed, or sensitive pending entries
 *   while preserving fresh unsettled transaction hashes by default so reload
 *   and reconnect idempotency locks (#1287) remain intact.
 */

export const WALLET_ADDRESS_STORAGE_KEY = 'iln_wallet_address';
export const WALLET_PROVIDER_STORAGE_KEY = 'iln_wallet_provider';
/** Dispatched to other tabs when this tab's wallet session is cleared so they
 *  drop retained session data too (cross-tab disconnect privacy, issue #1098). */
export const WALLET_DISCONNECT_STORAGE_KEY = 'iln_wallet_disconnect';
/** Latest wallet session intent published by the tab that changed account/network. */
export const WALLET_SESSION_STORAGE_KEY = 'iln_wallet_session';
/** Shared storage key for unsettled pending transactions audited here (#1293). */
export const PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY = 'iln_pending_transactions_v1';

/** Maximum retention window for unsettled pending transaction records (24h). */
export const PENDING_TRANSACTION_TTL_MS = 24 * 60 * 60 * 1000;
/** Tolerated positive clock skew before treating a timestamp as invalid (5m). */
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type WalletProviderType = 'freighter' | 'walletconnect';

export interface ClearWalletStorageOptions {
  /** Emit the cross-tab disconnect signal. Defaults to true. */
  broadcast?: boolean;
  /**
   * When true, removes all pending transaction records on disconnect.
   * Defaults to false so active unsettled hashes survive wallet reconnects
   * for reload/reconnect retry idempotency (#1287), while expired or tainted
   * entries are always scrubbed (#1293).
   */
  clearPendingTransactions?: boolean;
}

export type AuditedPendingTransactionStatus = 'submitted' | 'confirming';

export interface AuditedPendingTransactionRecord {
  hash: string;
  label?: string;
  operationKey?: string;
  address?: string;
  createdAt: number;
  lastCheckedAt?: number;
  status: AuditedPendingTransactionStatus;
}

export type PendingTransactionSanitizeResult =
  | {
      status: 'valid';
      record: AuditedPendingTransactionRecord;
      sanitized: boolean;
      strippedFields: string[];
    }
  | {
      status: 'expired';
      hash?: string;
      reason: string;
    }
  | {
      status: 'rejected';
      reason: string;
    };

export interface PendingTransactionStorageAuditResult {
  valid: AuditedPendingTransactionRecord[];
  expiredCount: number;
  rejectedCount: number;
  sanitizedCount: number;
  corrupted: boolean;
  recoveryMessage: string | null;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const ALLOWED_PENDING_TX_KEYS = new Set([
  'hash',
  'label',
  'operationKey',
  'address',
  'createdAt',
  'lastCheckedAt',
  'status',
]);

const STELLAR_SECRET_SEED_RE = /\bS[A-Z2-7]{55}\b/;
const STELLAR_PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;
const EMAIL_PII_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const JWT_OR_BEARER_RE = /\bBearer\s+\S+|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/i;
const PEM_OR_SECRET_LABEL_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----|mnemonic|seed\s*phrase/i;
const LONG_BASE64_XDR_RE = /^(?:[A-Za-z0-9+/]{80,}={0,2})$/;

/**
 * Returns true if `value` contains secret material (Stellar secret seed,
 * private key PEM, JWT/Bearer token, raw base64 XDR envelope) or personal
 * email PII that must never persist in pending transaction storage (#1293).
 */
export function containsSensitiveWalletData(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return (
    STELLAR_SECRET_SEED_RE.test(trimmed) ||
    EMAIL_PII_RE.test(trimmed) ||
    JWT_OR_BEARER_RE.test(trimmed) ||
    PEM_OR_SECRET_LABEL_RE.test(trimmed) ||
    LONG_BASE64_XDR_RE.test(trimmed)
  );
}

/**
 * Validates, strips non-allowlisted fields, checks for secret/PII leakage, and
 * enforces TTL expiry on a single persisted pending transaction entry (#1293).
 */
export function sanitizePendingTransactionRecord(
  raw: unknown,
  now = Date.now(),
  ttlMs = PENDING_TRANSACTION_TTL_MS
): PendingTransactionSanitizeResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { status: 'rejected', reason: 'malformed_entry' };
  }

  const obj = raw as Record<string, unknown>;
  const hash = typeof obj.hash === 'string' ? obj.hash.trim() : '';
  if (!hash || containsSensitiveWalletData(hash)) {
    return { status: 'rejected', reason: 'invalid_or_sensitive_hash' };
  }

  const createdAt = obj.createdAt;
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
    return { status: 'expired', hash, reason: 'missing_or_invalid_timestamp' };
  }

  const age = now - createdAt;
  if (age > ttlMs || age < -MAX_FUTURE_CLOCK_SKEW_MS) {
    return { status: 'expired', hash, reason: 'ttl_exceeded' };
  }

  const strippedFields: string[] = [];
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_PENDING_TX_KEYS.has(key)) {
      strippedFields.push(key);
    }
  }

  const status: AuditedPendingTransactionStatus =
    obj.status === 'confirming' ? 'confirming' : 'submitted';
  let sanitized = strippedFields.length > 0 || (obj.status !== 'submitted' && obj.status !== 'confirming');

  const record: AuditedPendingTransactionRecord = {
    hash,
    createdAt,
    status,
  };

  if (typeof obj.label === 'string') {
    const label = obj.label.trim();
    if (label && !containsSensitiveWalletData(label)) {
      record.label = label;
    } else if (label) {
      sanitized = true;
      strippedFields.push('label');
    }
  } else if (obj.label !== undefined) {
    sanitized = true;
    strippedFields.push('label');
  }

  if (typeof obj.operationKey === 'string') {
    const operationKey = obj.operationKey.trim();
    if (operationKey && !containsSensitiveWalletData(operationKey)) {
      record.operationKey = operationKey;
    } else if (operationKey) {
      sanitized = true;
      strippedFields.push('operationKey');
    }
  } else if (obj.operationKey !== undefined) {
    sanitized = true;
    strippedFields.push('operationKey');
  }

  if (typeof obj.address === 'string') {
    const address = obj.address.trim();
    if (STELLAR_SECRET_SEED_RE.test(address) || containsSensitiveWalletData(address)) {
      sanitized = true;
      strippedFields.push('address');
    } else if (address && (STELLAR_PUBLIC_KEY_RE.test(address) || address.startsWith('G'))) {
      record.address = address;
    } else if (address) {
      sanitized = true;
      strippedFields.push('address');
    }
  } else if (obj.address !== undefined) {
    sanitized = true;
    strippedFields.push('address');
  }

  if (typeof obj.lastCheckedAt === 'number' && Number.isFinite(obj.lastCheckedAt)) {
    record.lastCheckedAt = obj.lastCheckedAt;
  } else if (obj.lastCheckedAt !== undefined) {
    sanitized = true;
    strippedFields.push('lastCheckedAt');
  }

  return { status: 'valid', record, sanitized, strippedFields };
}

/**
 * Audits `iln_pending_transactions_v1` in browser storage: removes expired or
 * malformed records, strips any sensitive or unknown fields, and produces a
 * clear user-facing recovery message whenever records were cleared (#1293).
 */
export function auditPendingTransactionsStorage(
  storage: StorageLike = window.localStorage,
  options: { now?: number; ttlMs?: number; persistCleanup?: boolean } = {}
): PendingTransactionStorageAuditResult {
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? PENDING_TRANSACTION_TTL_MS;
  const persistCleanup = options.persistCleanup !== false;

  let raw: string | null = null;
  try {
    raw = storage.getItem(PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY);
  } catch {
    return {
      valid: [],
      expiredCount: 0,
      rejectedCount: 0,
      sanitizedCount: 0,
      corrupted: false,
      recoveryMessage: null,
    };
  }

  if (!raw) {
    return {
      valid: [],
      expiredCount: 0,
      rejectedCount: 0,
      sanitizedCount: 0,
      corrupted: false,
      recoveryMessage: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (persistCleanup) {
      try {
        storage.removeItem(PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY);
      } catch {
        // best-effort cleanup
      }
    }
    return {
      valid: [],
      expiredCount: 0,
      rejectedCount: 1,
      sanitizedCount: 0,
      corrupted: true,
      recoveryMessage:
        'Corrupted pending transaction storage was cleared. Check your wallet activity or Stellar Explorer before retrying any recent transaction.',
    };
  }

  if (!Array.isArray(parsed)) {
    if (persistCleanup) {
      try {
        storage.removeItem(PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY);
      } catch {
        // best-effort cleanup
      }
    }
    return {
      valid: [],
      expiredCount: 0,
      rejectedCount: 1,
      sanitizedCount: 0,
      corrupted: true,
      recoveryMessage:
        'Invalid pending transaction storage format was cleared. Check your wallet activity or Stellar Explorer before retrying any recent transaction.',
    };
  }

  const valid: AuditedPendingTransactionRecord[] = [];
  let expiredCount = 0;
  let rejectedCount = 0;
  let sanitizedCount = 0;

  for (const item of parsed) {
    const res = sanitizePendingTransactionRecord(item, now, ttlMs);
    if (res.status === 'valid') {
      valid.push(res.record);
      if (res.sanitized) sanitizedCount += 1;
    } else if (res.status === 'expired') {
      expiredCount += 1;
    } else {
      rejectedCount += 1;
    }
  }

  const changed = expiredCount > 0 || rejectedCount > 0 || sanitizedCount > 0;
  if (changed && persistCleanup) {
    try {
      if (valid.length === 0) {
        storage.removeItem(PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY);
      } else {
        storage.setItem(PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY, JSON.stringify(valid));
      }
    } catch {
      // best-effort cleanup
    }
  }

  let recoveryMessage: string | null = null;
  if (expiredCount > 0 || rejectedCount > 0) {
    const parts: string[] = [];
    if (expiredCount > 0) {
      parts.push(`${expiredCount} expired pending transaction ${expiredCount === 1 ? 'record' : 'records'}`);
    }
    if (rejectedCount > 0) {
      parts.push(`${rejectedCount} invalid pending transaction ${rejectedCount === 1 ? 'record' : 'records'}`);
    }
    recoveryMessage = `Cleared ${parts.join(' and ')}. Check your wallet activity or Stellar Explorer to confirm settlement before retrying.`;
  }

  return {
    valid,
    expiredCount,
    rejectedCount,
    sanitizedCount,
    corrupted: false,
    recoveryMessage,
  };
}

export function getStoredWalletProvider(
  storage: Storage = window.localStorage
): WalletProviderType | null {
  const value = storage.getItem(WALLET_PROVIDER_STORAGE_KEY);
  return value === 'freighter' || value === 'walletconnect' ? value : null;
}

export function setStoredWalletProvider(
  provider: WalletProviderType,
  storage: Storage = window.localStorage
): void {
  storage.setItem(WALLET_PROVIDER_STORAGE_KEY, provider);
}

/**
 * Prefixes/keys considered user-session data, removed on disconnect.
 * `iln-address-book-` covers both the legacy `<prefix><wallet>` key and the
 * origin/network-scoped `<prefix>v1-<tag>-<wallet>` key (walletRecordStore.ts).
 */
export const WALLET_SCOPED_PREFIXES = [
  'iln-address-book-',
  'iln-watchlist',
  'iln-referral-',
  'iln-invoices-',
  'iln-portfolio-',
  'freelancerInvoices',
];

export function clearWalletStorage(
  storage: Storage = window.localStorage,
  options: ClearWalletStorageOptions = {}
): void {
  storage.removeItem(WALLET_ADDRESS_STORAGE_KEY);
  storage.removeItem(WALLET_PROVIDER_STORAGE_KEY);
  storage.removeItem(WALLET_SESSION_STORAGE_KEY);
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && WALLET_SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((key) => storage.removeItem(key));

  // Audit pending transaction storage on disconnect (#1293): always scrub
  // expired, malformed, or sensitive entries while preserving fresh unsettled
  // hashes by default so reload/reconnect idempotency locks (#1287) survive.
  if (options.clearPendingTransactions) {
    storage.removeItem(PENDING_TRANSACTIONS_AUDIT_STORAGE_KEY);
  } else {
    auditPendingTransactionsStorage(storage, { persistCleanup: true });
  }

  // Notify other tabs so they clear retained session data as well. Remote
  // reconciliation passes `broadcast: false` to avoid an echo loop.
  if (options.broadcast !== false) {
    broadcastWalletDisconnect(storage);
  }
}

/** Signal every other tab that this tab's wallet session was cleared. */
export function broadcastWalletDisconnect(storage: Storage = window.localStorage): void {
  try {
    storage.setItem(WALLET_DISCONNECT_STORAGE_KEY, String(Date.now()));
    storage.removeItem(WALLET_DISCONNECT_STORAGE_KEY);
  } catch {
    // best-effort cross-tab signal
  }
}
