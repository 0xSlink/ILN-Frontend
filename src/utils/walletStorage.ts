/**
 * Wallet session storage, versioning, migrations, and safe degradation (#4, wave-9).
 *
 * Responsibilities:
 * 1. Safe storage abstraction that handles localStorage quota and privacy/security failures,
 *    gracefully falling back to an in-memory session store.
 * 2. Versioned envelopes and tested migrations for wallet-scoped serialized records (v0 -> v1)
 *    without silently dropping records.
 * 3. Validation before hydration: rejecting malformed records, unknown fields, and wrong wallet ownership.
 * 4. Centralised disconnect cleanup to ensure sensitive wallet-scoped session data is purged.
 */

export const WALLET_ADDRESS_STORAGE_KEY = 'iln_wallet_address';
export const WALLET_PROVIDER_STORAGE_KEY = 'iln_wallet_provider';
export const ADDRESS_BOOK_STORAGE_PREFIX = 'iln-address-book-';
export const ADDRESS_BOOK_STORAGE_VERSION = 1;

export type WalletProviderType = 'freighter' | 'walletconnect';

/** Prefixes/keys considered user-session data, removed on disconnect. */
export const WALLET_SCOPED_PREFIXES = [
  'iln-address-book-',
  'iln-watchlist',
  'iln-referral-',
  'iln-invoices-',
  'iln-portfolio-',
  'freelancerInvoices',
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. Storage Diagnostics & In-Memory Fallback (Safe Degraded Mode)
// ─────────────────────────────────────────────────────────────────────────────

export interface StorageStatus {
  available: boolean;
  degraded: boolean;
  quotaExceeded: boolean;
  lastError?: string;
}

export class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

let globalStorageStatus: StorageStatus = {
  available: true,
  degraded: false,
  quotaExceeded: false,
};

export function getStorageStatus(): StorageStatus {
  return { ...globalStorageStatus };
}

export function resetStorageStatus(): void {
  globalStorageStatus = {
    available: true,
    degraded: false,
    quotaExceeded: false,
  };
  singletonSafeStorage = null;
}

export function setDegradedMode(
  degraded: boolean,
  quotaExceeded = false,
  lastError?: string
): void {
  globalStorageStatus.degraded = degraded;
  globalStorageStatus.available = !degraded;
  globalStorageStatus.quotaExceeded = quotaExceeded;
  if (lastError) {
    globalStorageStatus.lastError = lastError;
  }
}

export class SafeStorage implements Storage {
  private memoryFallback: MemoryStorage;
  private backend: Storage | null;

  constructor(backend?: Storage) {
    this.memoryFallback = new MemoryStorage();
    if (backend) {
      this.backend = backend;
    } else if (typeof window !== 'undefined') {
      try {
        this.backend = window.localStorage;
      } catch {
        // window.localStorage may throw SecurityError in restricted environments
        this.backend = null;
        globalStorageStatus.available = false;
        globalStorageStatus.degraded = true;
        globalStorageStatus.lastError = 'localStorage access denied; degraded to in-memory mode.';
      }
    } else {
      this.backend = null;
    }
  }

  get length(): number {
    if (this.backend && !globalStorageStatus.degraded) {
      try {
        return this.backend.length;
      } catch {
        // Fall back to memory
      }
    }
    return this.memoryFallback.length;
  }

  clear(): void {
    this.memoryFallback.clear();
    if (this.backend) {
      try {
        this.backend.clear();
      } catch {
        // Ignore backend clear failures in degraded mode
      }
    }
  }

  getItem(key: string): string | null {
    // If in-memory store has an active write for this session, prioritize it
    const memVal = this.memoryFallback.getItem(key);
    if (memVal !== null) {
      return memVal;
    }

    if (this.backend) {
      try {
        return this.backend.getItem(key);
      } catch {
        globalStorageStatus.available = false;
        globalStorageStatus.degraded = true;
        globalStorageStatus.lastError = 'Storage read failed; falling back to in-memory mode.';
      }
    }
    return null;
  }

  key(index: number): string | null {
    if (this.backend && !globalStorageStatus.degraded) {
      try {
        return this.backend.key(index);
      } catch {
        // Fall back to memory
      }
    }
    return this.memoryFallback.key(index);
  }

  removeItem(key: string): void {
    this.memoryFallback.removeItem(key);
    if (this.backend) {
      try {
        this.backend.removeItem(key);
      } catch {
        // Fallback already cleared
      }
    }
  }

  setItem(key: string, value: string): void {
    const stringVal = String(value);

    if (!this.backend) {
      this.memoryFallback.setItem(key, stringVal);
      globalStorageStatus.available = false;
      globalStorageStatus.degraded = true;
      return;
    }

    try {
      this.backend.setItem(key, stringVal);
    } catch (err: unknown) {
      const errLike = err as { name?: string; code?: number; message?: string } | undefined;
      const errName = errLike?.name;
      const errCode = errLike?.code;
      const isQuota =
        errName === 'QuotaExceededError' ||
        errCode === 22 ||
        errCode === 1014 ||
        String(errLike?.message ?? '')
          .toLowerCase()
          .includes('quota');

      globalStorageStatus.available = false;
      globalStorageStatus.degraded = true;
      if (isQuota) {
        globalStorageStatus.quotaExceeded = true;
        globalStorageStatus.lastError =
          'Storage quota exceeded; downgraded to in-memory session storage.';
      } else {
        globalStorageStatus.lastError =
          'Storage write restricted or blocked; downgraded to in-memory session storage.';
      }

      // Preserve data in memory fallback so caller's session does not lose state
      this.memoryFallback.setItem(key, stringVal);
    }
  }
}

let singletonSafeStorage: SafeStorage | null = null;

export function getSafeStorage(backend?: Storage): Storage {
  if (backend) {
    return new SafeStorage(backend);
  }
  if (!singletonSafeStorage) {
    singletonSafeStorage = new SafeStorage();
  }
  return singletonSafeStorage;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Wallet Provider & Address Session Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getStoredWalletProvider(
  storage: Storage = getSafeStorage()
): WalletProviderType | null {
  try {
    const value = storage.getItem(WALLET_PROVIDER_STORAGE_KEY);
    return value === 'freighter' || value === 'walletconnect' ? value : null;
  } catch {
    return null;
  }
}

export function setStoredWalletProvider(
  provider: WalletProviderType,
  storage: Storage = getSafeStorage()
): void {
  try {
    storage.setItem(WALLET_PROVIDER_STORAGE_KEY, provider);
  } catch {
    // Gracefully handled via SafeStorage
  }
}

export function getStoredWalletAddress(storage: Storage = getSafeStorage()): string | null {
  try {
    return storage.getItem(WALLET_ADDRESS_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredWalletAddress(address: string, storage: Storage = getSafeStorage()): void {
  try {
    storage.setItem(WALLET_ADDRESS_STORAGE_KEY, address);
  } catch {
    // Gracefully handled via SafeStorage
  }
}

export function clearWalletStorage(storage: Storage = getSafeStorage()): void {
  try {
    storage.removeItem(WALLET_ADDRESS_STORAGE_KEY);
    storage.removeItem(WALLET_PROVIDER_STORAGE_KEY);
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && WALLET_SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((key) => storage.removeItem(key));
  } catch {
    // Suppress storage clearing errors on disconnect
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Address Book Types, Envelopes & Versioning
// ─────────────────────────────────────────────────────────────────────────────

export interface AddressBookEntry {
  id: string;
  address: string;
  nickname: string;
}

export interface VersionedStorageEnvelope<T> {
  version: number;
  walletAddress: string;
  data: T;
  updatedAt: number;
}

export type AddressBookStorageEnvelope = VersionedStorageEnvelope<AddressBookEntry[]>;

export interface AddressBookValidationResult {
  valid: boolean;
  entry?: AddressBookEntry;
  reason?: string;
}

export interface AddressBookHydrationResult {
  success: boolean;
  entries: AddressBookEntry[];
  version: number;
  migrated: boolean;
  ownershipVerified: boolean;
  error?: string;
  rejectedCount: number;
  reasons: string[];
}

/** Known allowed properties on an AddressBookEntry to reject unknown fields. */
const ALLOWED_ENTRY_KEYS = new Set(['id', 'address', 'nickname']);

// Matches valid alphanumeric/symbolic address strings without control characters or whitespace
const VALID_ADDRESS_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Validates a single address book entry:
 * - Rejects malformed types (non-objects, null, arrays)
 * - Rejects unknown/extraneous fields
 * - Validates format and lengths of id, address, and nickname
 */
export function validateAddressBookEntry(entry: unknown): AddressBookValidationResult {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return { valid: false, reason: 'Entry must be a non-null object' };
  }

  const record = entry as Record<string, unknown>;
  const keys = Object.keys(record);

  // Reject unknown fields
  const unknownKeys = keys.filter((k) => !ALLOWED_ENTRY_KEYS.has(k));
  if (unknownKeys.length > 0) {
    return {
      valid: false,
      reason: `Entry contains unknown/unauthorized fields: ${unknownKeys.join(', ')}`,
    };
  }

  // Validate ID
  if (typeof record.id !== 'string' || record.id.trim().length === 0) {
    return { valid: false, reason: 'Entry id must be a non-empty string' };
  }
  if (record.id.length > 128) {
    return { valid: false, reason: 'Entry id exceeds maximum allowed length of 128' };
  }

  // Validate Address
  if (typeof record.address !== 'string' || record.address.trim().length === 0) {
    return { valid: false, reason: 'Entry address must be a non-empty string' };
  }
  const trimmedAddress = record.address.trim();
  if (!VALID_ADDRESS_PATTERN.test(trimmedAddress)) {
    return { valid: false, reason: 'Entry address contains invalid characters' };
  }

  // Validate Nickname
  if (typeof record.nickname !== 'string' || record.nickname.trim().length === 0) {
    return { valid: false, reason: 'Entry nickname must be a non-empty string' };
  }
  const trimmedNickname = record.nickname.trim();
  if (trimmedNickname.length > 100) {
    return { valid: false, reason: 'Entry nickname exceeds maximum length of 100' };
  }

  return {
    valid: true,
    entry: {
      id: record.id.trim(),
      address: trimmedAddress,
      nickname: trimmedNickname,
    },
  };
}

/**
 * Generates an entry ID with millisecond timestamp and random entropy.
 */
export function createEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Serializes an address book list into a versioned envelope tied to the owner's wallet address.
 */
export function serializeAddressBookEnvelope(
  entries: AddressBookEntry[],
  walletAddress: string
): string {
  const envelope: AddressBookStorageEnvelope = {
    version: ADDRESS_BOOK_STORAGE_VERSION,
    walletAddress,
    data: entries,
    updatedAt: Date.now(),
  };
  return JSON.stringify(envelope);
}

/**
 * Hydrates, validates, and migrates stored address book data:
 * 1. Checks wallet ownership on versioned envelopes (rejects if tagged walletAddress does not match expectedWalletAddress).
 * 2. Migrates v0 (legacy unversioned array) to v1 without silently dropping valid records.
 * 3. Enforces strict entry validation (rejects malformed records & unknown fields).
 * 4. Provides typed errors and explicit diagnostics.
 */
export function hydrateAddressBookRecords(
  rawJson: string | null,
  expectedWalletAddress: string
): AddressBookHydrationResult {
  if (!rawJson || rawJson.trim() === '') {
    return {
      success: true,
      entries: [],
      version: ADDRESS_BOOK_STORAGE_VERSION,
      migrated: false,
      ownershipVerified: true,
      rejectedCount: 0,
      reasons: [],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      success: false,
      entries: [],
      version: 0,
      migrated: false,
      ownershipVerified: false,
      error: 'Corrupted address book storage: invalid JSON format.',
      rejectedCount: 0,
      reasons: ['JSON parse failure'],
    };
  }

  // ─── Case 1: Legacy v0 unversioned array ──────────────────────────────────
  if (Array.isArray(parsed)) {
    const validEntries: AddressBookEntry[] = [];
    const reasons: string[] = [];
    let rejectedCount = 0;

    for (const rawItem of parsed) {
      // In legacy data, an item might be missing id; generate one if address and nickname exist
      let candidate = rawItem;
      if (
        typeof rawItem === 'object' &&
        rawItem !== null &&
        !Array.isArray(rawItem) &&
        !('id' in rawItem) &&
        typeof (rawItem as Record<string, unknown>).address === 'string' &&
        typeof (rawItem as Record<string, unknown>).nickname === 'string'
      ) {
        candidate = {
          id: createEntryId(),
          address: (rawItem as Record<string, unknown>).address,
          nickname: (rawItem as Record<string, unknown>).nickname,
        };
      }

      const validation = validateAddressBookEntry(candidate);
      if (validation.valid && validation.entry) {
        validEntries.push(validation.entry);
      } else {
        rejectedCount += 1;
        reasons.push(validation.reason ?? 'Malformed legacy entry');
      }
    }

    return {
      success: true,
      entries: validEntries,
      version: ADDRESS_BOOK_STORAGE_VERSION,
      migrated: true,
      ownershipVerified: true,
      rejectedCount,
      reasons,
    };
  }

  // ─── Case 2: Versioned envelope ──────────────────────────────────────────
  if (typeof parsed === 'object' && parsed !== null && 'version' in parsed) {
    const envelope = parsed as Record<string, unknown>;
    const version = typeof envelope.version === 'number' ? envelope.version : 0;
    const storedWallet = typeof envelope.walletAddress === 'string' ? envelope.walletAddress : '';

    // Verify wallet ownership (wallet/network isolation)
    if (!storedWallet || storedWallet.toLowerCase() !== expectedWalletAddress.toLowerCase()) {
      return {
        success: false,
        entries: [],
        version,
        migrated: false,
        ownershipVerified: false,
        error: 'Wallet ownership mismatch: stored address book does not belong to active wallet.',
        rejectedCount: 0,
        reasons: ['Wrong wallet ownership detected'],
      };
    }

    // Version 1 envelope handling
    if (version === 1) {
      if (!Array.isArray(envelope.data)) {
        return {
          success: false,
          entries: [],
          version: 1,
          migrated: false,
          ownershipVerified: true,
          error: 'Malformed storage envelope: data is not an array.',
          rejectedCount: 0,
          reasons: ['Envelope data payload invalid'],
        };
      }

      const validEntries: AddressBookEntry[] = [];
      const reasons: string[] = [];
      let rejectedCount = 0;

      for (const item of envelope.data) {
        const validation = validateAddressBookEntry(item);
        if (validation.valid && validation.entry) {
          validEntries.push(validation.entry);
        } else {
          rejectedCount += 1;
          reasons.push(validation.reason ?? 'Malformed entry');
        }
      }

      return {
        success: true,
        entries: validEntries,
        version: 1,
        migrated: false,
        ownershipVerified: true,
        rejectedCount,
        reasons,
      };
    }

    // Unsupported future versions
    if (version > ADDRESS_BOOK_STORAGE_VERSION) {
      return {
        success: false,
        entries: [],
        version,
        migrated: false,
        ownershipVerified: true,
        error: `Unsupported address book schema version (${version}). Migration path unavailable.`,
        rejectedCount: 0,
        reasons: ['Future storage version'],
      };
    }
  }

  // Malformed structure (neither array nor recognized envelope)
  return {
    success: false,
    entries: [],
    version: 0,
    migrated: false,
    ownershipVerified: false,
    error: 'Unrecognized address book storage schema.',
    rejectedCount: 0,
    reasons: ['Invalid payload schema'],
  };
}
