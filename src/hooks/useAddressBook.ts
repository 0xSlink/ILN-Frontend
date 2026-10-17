import { useState, useCallback, useEffect, useRef } from 'react';
import { useWallet } from '@/context/WalletContext';
import { isValidStellarAddress } from '@/utils/governance';
import {
  deriveKeyFromWalletAddress,
  encryptForStorage,
  decryptFromStorage,
} from '@/utils/addressBookCrypto';

export interface AddressBookEntry {
  id: string;
  address: string;
  nickname: string;
}

/** Reason a mutating operation failed, returned to the caller for UI feedback. */
export type AddressBookError =
  | 'INVALID_ADDRESS'
  | 'DUPLICATE_ADDRESS'
  | 'MISSING_FIELDS'
  | 'PERSIST_FAILED'
  | 'DECRYPT_FAILED';

/** Discriminated result from operations that can fail. */
export type AddressBookResult = { ok: true } | { ok: false; error: AddressBookError };

/**
 * Load lifecycle of the persisted address book:
 * - `idle`        no wallet connected
 * - `loading`     wallet connected, storage not read yet
 * - `ready`       storage read (possibly after discarding a rejected record)
 * - `unavailable` storage threw on read; nothing is overwritten
 */
export type AddressBookStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

/** Why a stored address book was discarded on load (#1097). */
export type AddressBookRecovery = WalletRecordRejection;

const MAX_ENTRIES = 50;

// Date.now() alone collides for entries created within the same millisecond,
// which made deleteAddress() remove every entry added in the same tick.
function createEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isAddressBookEntry(value: unknown): value is AddressBookEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.address === 'string' &&
    typeof entry.nickname === 'string'
  );
}

function isAddressBookEntries(value: unknown): value is AddressBookEntry[] {
  return Array.isArray(value) && value.length <= MAX_ENTRIES && value.every(isAddressBookEntry);
}

/**
 * Attempt to persist the address book as an integrity-checked, origin/network
 * scoped record. Returns false if the write throws (e.g. storage full,
 * private-browsing quota, or a test-injected failure).
 */
function tryPersist(walletAddress: string, entries: AddressBookEntry[]): boolean {
  return writeWalletRecord('address-book', currentWalletRecordScope(walletAddress), entries, {
    storage: localStorage,
  });
}

export default function useAddressBook() {
  const { address: walletAddress } = useWallet();
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  const [status, setStatus] = useState<AddressBookStatus>(walletAddress ? 'loading' : 'idle');
  const [recovery, setRecovery] = useState<AddressBookRecovery | null>(null);
  // Skips the save that runs immediately after a (re)load, so the freshly
  // mounted empty state never overwrites what is already in localStorage.
  const skipNextSaveRef = useRef(true);

  // ── Load (with decryption) ─────────────────────────────────────────────────

  useEffect(() => {
    skipNextSaveRef.current = true;

    setRecovery(null);

    if (!walletAddress) {
      setAddressBook([]);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    const scope = currentWalletRecordScope(walletAddress);
    const result = readWalletRecord('address-book', scope, isAddressBookEntries, {
      storage: localStorage,
    });
    switch (result.status) {
      case 'ok':
        setAddressBook(result.data);
        setStatus('ready');
        // Sliding retention: using the address book keeps it alive (#1088).
        if (!result.migrated) {
          writeWalletRecord('address-book', scope, result.data, { storage: localStorage });
        }
        break;
      case 'missing':
        setAddressBook([]);
        setStatus('ready');
        break;
      case 'rejected':
        console.warn(`Discarded stored address book: ${result.reason}`);
        setAddressBook([]);
        setRecovery(result.reason);
        setStatus('ready');
        break;
      case 'unavailable':
        setAddressBook([]);
        setStatus('unavailable');
        break;
    }

    loadAndDecrypt();

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    // Persistence is handled explicitly by addAddress / updateAddress / deleteAddress
    // so that callers receive a failure signal when the write fails.
  }, [addressBook, walletAddress]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Obtain the current CryptoKey, deriving it on demand if not yet available.
   * Returns null when there is no connected wallet.
   */
  async function getKey(): Promise<CryptoKey | null> {
    if (!walletAddress) return null;
    if (currentWalletRef.current !== walletAddress || !cryptoKeyRef.current) {
      cryptoKeyRef.current = await deriveKeyFromWalletAddress(walletAddress);
      currentWalletRef.current = walletAddress;
    }
    return cryptoKeyRef.current;
  }

  // ── addAddress ─────────────────────────────────────────────────────────────

  /**
   * Add a new entry.
   * Validates format and detects duplicates before touching state.
   * Returns a result object so callers can surface the right error message.
   */
  const addAddress = useCallback(
    async (address: string, nickname: string): Promise<AddressBookResult> => {
      if (!address || !nickname) return { ok: false, error: 'MISSING_FIELDS' };

      if (!isValidStellarAddress(address)) return { ok: false, error: 'INVALID_ADDRESS' };

      // Duplicate: exact address match — surface an explicit error instead of
      // silently updating the nickname, which was invisible to the user.
      if (addressBook.some((entry) => entry.address === address)) {
        return { ok: false, error: 'DUPLICATE_ADDRESS' };
      }

      const newEntry: AddressBookEntry = { id: createEntryId(), address, nickname };
      // Enforce max 50 entries by evicting the oldest (first) when at capacity.
      const next =
        addressBook.length >= MAX_ENTRIES
          ? [...addressBook.slice(1), newEntry]
          : [...addressBook, newEntry];

      if (walletAddress && !tryPersist(walletAddress, next)) {
        return { ok: false, error: 'PERSIST_FAILED' };
      }

      setAddressBook(next);
      return { ok: true };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addressBook, walletAddress]
  );

  // ── updateAddress ──────────────────────────────────────────────────────────

  /**
   * Update an existing entry by id.
   * Validates the new address format and checks for duplicates against other entries.
   * Rolls back state on persistence failure.
   */
  const updateAddress = useCallback(
    async (id: string, updates: Partial<Omit<AddressBookEntry, 'id'>>): Promise<AddressBookResult> => {
      if (updates.address !== undefined) {
        if (!isValidStellarAddress(updates.address)) {
          return { ok: false, error: 'INVALID_ADDRESS' };
        }
        // Duplicate check: another entry (not the one being edited) uses this address
        if (addressBook.some((entry) => entry.id !== id && entry.address === updates.address)) {
          return { ok: false, error: 'DUPLICATE_ADDRESS' };
        }
      }

      const next = addressBook.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry));

      if (walletAddress && !tryPersist(walletAddress, next)) {
        // Do NOT update React state — UI stays consistent with what is on disk.
        return { ok: false, error: 'PERSIST_FAILED' };
      }

      setAddressBook(next);
      return { ok: true };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addressBook, walletAddress]
  );

  // ── deleteAddress ──────────────────────────────────────────────────────────

  const deleteAddress = useCallback(
    (id: string) => {
      setAddressBook((prev) => {
        const next = prev.filter((entry) => entry.id !== id);
        if (walletAddress) {
          tryPersist(walletAddress, next);
        }
      }
      setAddressBook(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addressBook, walletAddress]
  );

  // ── searchAddresses ────────────────────────────────────────────────────────

  const searchAddresses = useCallback(
    (query: string) => {
      if (!query) return addressBook;
      const lowerQuery = query.toLowerCase();
      return addressBook.filter(
        (entry) =>
          entry.nickname.toLowerCase().includes(lowerQuery) ||
          entry.address.toLowerCase().includes(lowerQuery)
      );
    },
    [addressBook]
  );

  const dismissRecovery = useCallback(() => setRecovery(null), []);

  return {
    addressBook,
    isLoading,
    loadError,
    addAddress,
    updateAddress,
    deleteAddress,
    searchAddresses,
  };
}
