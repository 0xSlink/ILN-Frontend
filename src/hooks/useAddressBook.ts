import { useState, useCallback, useEffect, useRef } from 'react';
import { useWallet } from '@/context/WalletContext';
import { isValidStellarAddress } from '@/utils/governance';
import { clearWalletStorage, WALLET_DISCONNECT_STORAGE_KEY } from '@/utils/walletStorage';
import { encryptValue, decryptValue } from '@/utils/walletCrypto';

export interface AddressBookEntry {
  id: string;
  address: string;
  nickname: string;
  /** When the entry was first created (ms epoch). */
  createdAt: number;
  /** When the entry expires and should be dropped (ms epoch). */
  retentionAt: number;
}

/** Reason a mutating operation failed, returned to the caller for UI feedback. */
export type AddressBookError =
  | 'INVALID_ADDRESS'
  | 'DUPLICATE_ADDRESS'
  | 'MISSING_FIELDS'
  | 'PERSIST_FAILED'
  | 'CRYPTO_FAILED';

/** Discriminated result from operations that can fail. */
export type AddressBookResult = { ok: true } | { ok: false; error: AddressBookError };

const STORAGE_KEY_PREFIX = 'iln-address-book-';
/** Key recording whether the user opted out of address-book persistence (#1099). */
const PERSIST_OPT_OUT_KEY = 'iln_address_book_persist_optout';
/** Default retention window for remembered address-book entries: 30 days. */
const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// Date.now() alone collides for entries created within the same millisecond,
// which made deleteAddress() remove every entry added in the same tick.
function createEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Attempt to persist the (encrypted) address book to localStorage.
 * Returns true on success, false if the write throws or encryption fails.
 */
async function tryPersist(key: string, entries: AddressBookEntry[]): Promise<boolean> {
  try {
    const serializable = entries.map((entry) => ({
      ...entry,
      address: await encryptValue(entry.address),
    }));
    localStorage.setItem(key, JSON.stringify(serializable));
    return true;
  } catch (e) {
    console.error('Failed to persist address book to localStorage', e);
    return false;
  }
}

/** Read and decrypt the address book from localStorage, dropping expired entries. */
async function loadPersisted(key: string): Promise<AddressBookEntry[]> {
  const stored = localStorage.getItem(key);
  if (!stored) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse address book from localStorage', e);
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const now = Date.now();
  const entries: AddressBookEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as AddressBookEntry & { address?: unknown };
    // Drop entries past their retention window (#1100).
    if (typeof entry.retentionAt === 'number' && entry.retentionAt < now) continue;
    if (typeof entry.createdAt !== 'number') entry.createdAt = now;
    if (typeof entry.retentionAt !== 'number') entry.retentionAt = now + DEFAULT_RETENTION_MS;
    if (typeof entry.address === 'string') {
      const decrypted = await decryptValue(entry.address);
      if (decrypted === null) continue; // undecryptable outside this session
      entry.address = decrypted;
    }
    if (typeof entry.address === 'string' && typeof entry.nickname === 'string' && entry.id) {
      entries.push({
        id: entry.id,
        address: entry.address,
        nickname: entry.nickname,
        createdAt: entry.createdAt,
        retentionAt: entry.retentionAt,
      });
    }
  }
  return entries;
}

export default function useAddressBook() {
  const { address: walletAddress } = useWallet();
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  // Skips the save that runs immediately after a (re)load, so the freshly
  // mounted empty state never overwrites what is already in localStorage.
  const skipNextSaveRef = useRef(true);
  // Whether the user has opted out of persisting the address book (#1099).
  const [persistEnabled, setPersistEnabled] = useState<boolean>(true);

  useEffect(() => {
    skipNextSaveRef.current = true;

    if (!walletAddress) {
      setAddressBook([]);
      return;
    }
    void loadPersisted(`${STORAGE_KEY_PREFIX}${walletAddress}`).then((entries) => {
      setAddressBook(entries);
    });

    // Respect the persisted opt-out flag on mount (#1099).
    const optOut = localStorage.getItem(PERSIST_OPT_OUT_KEY);
    setPersistEnabled(optOut !== 'true');
  }, [walletAddress]);

  /**
   * Cross-tab disconnect privacy (#1098).
   * When another tab clears its wallet session it broadcasts a storage event
   * on WALLET_DISCONNECT_STORAGE_KEY. This tab must not retain or display the
   * previous session's address-book data after logout.
   */
  useEffect(() => {
    const handleDisconnectBroadcast = (event: StorageEvent) => {
      if (event.key === WALLET_DISCONNECT_STORAGE_KEY) {
        setAddressBook([]);
        clearWalletStorage();
      }
    };
    window.addEventListener('storage', handleDisconnectBroadcast);
    return () => window.removeEventListener('storage', handleDisconnectBroadcast);
  }, []);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    // Persistence is handled explicitly by addAddress / updateAddress / deleteAddress
    // so that callers receive a failure signal when the write fails.
  }, [addressBook, walletAddress]);

  /**
   * Explicitly clear the remembered address-book data (#1099).
   */
  const clearAddressBook = useCallback(async (): Promise<AddressBookResult> => {
    const storageKey = `${STORAGE_KEY_PREFIX}${walletAddress}`;
    if (walletAddress) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        return { ok: false, error: 'PERSIST_FAILED' };
      }
    }
    setAddressBook([]);
    return { ok: true };
  }, [walletAddress]);

  /**
   * Opt-out control for local address-book persistence (#1099).
   * When disabled, existing stored data is cleared and no further writes occur.
   */
  const setPersistPreference = useCallback(
    (enabled: boolean): void => {
      localStorage.setItem(PERSIST_OPT_OUT_KEY, enabled ? 'null' : 'true');
      setPersistEnabled(enabled);
      if (!enabled) {
        void clearAddressBook();
      }
    },
    [clearAddressBook]
  );

  /**
   * Add a new entry.
   * Validates format and detects duplicates before touching state.
   * Returns a result object so callers can surface the right error message.
   */
  const addAddress = useCallback(
    async (address: string, nickname: string): Promise<AddressBookResult> => {
      if (!address || !nickname) return { ok: false, error: 'MISSING_FIELDS' };

      if (!isValidStellarAddress(address)) return { ok: false, error: 'INVALID_ADDRESS' };

      if (addressBook.some((entry) => entry.address === address)) {
        return { ok: false, error: 'DUPLICATE_ADDRESS' };
      }

      const now = Date.now();
      const newEntry: AddressBookEntry = {
        id: createEntryId(),
        address,
        nickname,
        createdAt: now,
        retentionAt: now + DEFAULT_RETENTION_MS,
      };
      // Enforce max 50 entries by evicting the oldest (first) when at capacity.
      const next =
        addressBook.length >= 50 ? [...addressBook.slice(1), newEntry] : [...addressBook, newEntry];

      const storageKey = `${STORAGE_KEY_PREFIX}${walletAddress}`;
      if (walletAddress && persistEnabled && !(await tryPersist(storageKey, next))) {
        return { ok: false, error: 'PERSIST_FAILED' };
      }

      setAddressBook(next);
      return { ok: true };
    },
    [addressBook, walletAddress, persistEnabled]
  );

  /**
   * Update an existing entry by id.
   * Validates the new address format and checks for duplicates against other entries.
   * Rolls back state on persistence failure.
   */
  const updateAddress = useCallback(
    async (
      id: string,
      updates: Partial<Omit<AddressBookEntry, 'id'>>
    ): Promise<AddressBookResult> => {
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
      if (walletAddress && persistEnabled && !(await tryPersist(storageKey, next))) {
        // Do NOT update React state — UI stays consistent with what is on disk.
        return { ok: false, error: 'PERSIST_FAILED' };
      }

      setAddressBook(next);
      return { ok: true };
    },
    [addressBook, walletAddress, persistEnabled]
  );

  const deleteAddress = useCallback(
    async (id: string): Promise<AddressBookResult> => {
      setAddressBook((prev) => {
        const next = prev.filter((entry) => entry.id !== id);
        if (walletAddress && persistEnabled) {
          void tryPersist(`${STORAGE_KEY_PREFIX}${walletAddress}`, next);
        }
        return next;
      });
      return { ok: true };
    },
    [walletAddress, persistEnabled]
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
    clearAddressBook,
    searchAddresses,
    persistEnabled,
    setPersistPreference,
  };
}
