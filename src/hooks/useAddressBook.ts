import { useState, useCallback, useEffect, useRef } from 'react';
import { useWallet } from '@/context/WalletContext';
import { isValidStellarAddress } from '@/utils/governance';

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
  | 'PERSIST_FAILED';

/** Discriminated result from operations that can fail. */
export type AddressBookResult = { ok: true } | { ok: false; error: AddressBookError };

const STORAGE_KEY_PREFIX = 'iln-address-book-';

// Date.now() alone collides for entries created within the same millisecond,
// which made deleteAddress() remove every entry added in the same tick.
function createEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Attempt to persist the address book to localStorage.
 * Returns true on success, false if the write throws (e.g. storage full,
 * private-browsing quota, or a test-injected failure).
 */
function tryPersist(key: string, entries: AddressBookEntry[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
    return true;
  } catch (e) {
    console.error('Failed to persist address book to localStorage', e);
    return false;
  }
}

export default function useAddressBook() {
  const { address: walletAddress } = useWallet();
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  // Skips the save that runs immediately after a (re)load, so the freshly
  // mounted empty state never overwrites what is already in localStorage.
  const skipNextSaveRef = useRef(true);

  useEffect(() => {
    skipNextSaveRef.current = true;

    if (!walletAddress) {
      setAddressBook([]);
      return;
    }
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${walletAddress}`);
    if (stored) {
      try {
        setAddressBook(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse address book from localStorage', e);
        setAddressBook([]);
      }
    } else {
      setAddressBook([]);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    // Persistence is handled explicitly by addAddress / updateAddress / deleteAddress
    // so that callers receive a failure signal when the write fails.
  }, [addressBook, walletAddress]);

  /**
   * Add a new entry.
   * Validates format and detects duplicates before touching state.
   * Returns a result object so callers can surface the right error message.
   */
  const addAddress = useCallback(
    (address: string, nickname: string): AddressBookResult => {
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
        addressBook.length >= 50 ? [...addressBook.slice(1), newEntry] : [...addressBook, newEntry];

      const storageKey = `${STORAGE_KEY_PREFIX}${walletAddress}`;
      if (walletAddress && !tryPersist(storageKey, next)) {
        return { ok: false, error: 'PERSIST_FAILED' };
      }

      setAddressBook(next);
      return { ok: true };
    },
    [addressBook, walletAddress]
  );

  /**
   * Update an existing entry by id.
   * Validates the new address format and checks for duplicates against other entries.
   * Rolls back state on persistence failure.
   */
  const updateAddress = useCallback(
    (id: string, updates: Partial<Omit<AddressBookEntry, 'id'>>): AddressBookResult => {
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

      const storageKey = `${STORAGE_KEY_PREFIX}${walletAddress}`;
      if (walletAddress && !tryPersist(storageKey, next)) {
        // Do NOT update React state — UI stays consistent with what is on disk.
        return { ok: false, error: 'PERSIST_FAILED' };
      }

      setAddressBook(next);
      return { ok: true };
    },
    [addressBook, walletAddress]
  );

  const deleteAddress = useCallback(
    (id: string) => {
      setAddressBook((prev) => {
        const next = prev.filter((entry) => entry.id !== id);
        if (walletAddress) {
          tryPersist(`${STORAGE_KEY_PREFIX}${walletAddress}`, next);
        }
        return next;
      });
    },
    [walletAddress]
  );

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

  return {
    addressBook,
    addAddress,
    updateAddress,
    deleteAddress,
    searchAddresses,
  };
}
