import { useState, useCallback, useEffect, useRef } from 'react';
import { useWallet } from '@/context/WalletContext';
import {
  type AddressBookEntry,
  ADDRESS_BOOK_STORAGE_PREFIX,
  createEntryId,
  getSafeStorage,
  getStorageStatus,
  hydrateAddressBookRecords,
  serializeAddressBookEnvelope,
  validateAddressBookEntry,
} from '@/utils/walletStorage';

export type { AddressBookEntry };

export interface AddressBookHookState {
  addressBook: AddressBookEntry[];
  addAddress: (address: string, nickname: string) => boolean;
  updateAddress: (id: string, updates: Partial<Omit<AddressBookEntry, 'id'>>) => void;
  deleteAddress: (id: string) => void;
  searchAddresses: (query: string) => AddressBookEntry[];
  isLoading: boolean;
  isDegraded: boolean;
  error: string | null;
  validationIssues: { rejectedCount: number; reasons: string[] } | null;
  retryHydration: () => void;
  clearCorruptedState: () => void;
}

export default function useAddressBook(): AddressBookHookState {
  const { address: walletAddress } = useWallet();
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDegradedState, setIsDegraded] = useState<boolean>(false);
  const isDegraded = isDegradedState || getStorageStatus().degraded;
  const [validationIssues, setValidationIssues] = useState<{
    rejectedCount: number;
    reasons: string[];
  } | null>(null);

  // Skips the save that runs immediately after a (re)load, so the freshly
  // mounted empty state never overwrites what is already in storage.
  const skipNextSaveRef = useRef(true);
  const storage = getSafeStorage();

  const loadAndHydrate = useCallback(() => {
    skipNextSaveRef.current = true;
    setError(null);
    setValidationIssues(null);

    if (!walletAddress) {
      setAddressBook([]);
      setIsLoading(false);
      setIsDegraded(getStorageStatus().degraded);
      return;
    }

    setIsLoading(true);
    const storageKey = `${ADDRESS_BOOK_STORAGE_PREFIX}${walletAddress}`;
    const rawStored = storage.getItem(storageKey);

    const hydration = hydrateAddressBookRecords(rawStored, walletAddress);

    if (hydration.success) {
      setAddressBook(hydration.entries);
      if (hydration.migrated) {
        // Persist migrated envelope back to storage
        try {
          storage.setItem(
            storageKey,
            serializeAddressBookEnvelope(hydration.entries, walletAddress)
          );
        } catch {
          // Handled via safe storage degraded mode
        }
      }
      if (hydration.rejectedCount > 0) {
        setValidationIssues({
          rejectedCount: hydration.rejectedCount,
          reasons: hydration.reasons,
        });
      }
      setError(null);
    } else {
      // Rejection: malformed data or wrong wallet ownership
      setError(hydration.error || 'Failed to hydrate address book');
      setAddressBook([]);
    }

    setIsLoading(false);
  }, [walletAddress, storage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAndHydrate();
  }, [loadAndHydrate]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (!walletAddress) return;
    // If there is an active loading or ownership error, avoid overwriting
    if (error !== null) return;

    try {
      const storageKey = `${ADDRESS_BOOK_STORAGE_PREFIX}${walletAddress}`;
      storage.setItem(storageKey, serializeAddressBookEnvelope(addressBook, walletAddress));
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDegraded(true);
    }
  }, [addressBook, walletAddress, error, storage]);

  const addAddress = useCallback(
    (address: string, nickname: string): boolean => {
      if (!address || !nickname) return false;

      const trimmedAddress = address.trim();
      const trimmedNickname = nickname.trim();
      if (!trimmedAddress || !trimmedNickname) return false;

      // Validate entry format
      const validation = validateAddressBookEntry({
        id: createEntryId(),
        address: trimmedAddress,
        nickname: trimmedNickname,
      });

      if (!validation.valid || !validation.entry) {
        return false;
      }

      // Check for duplicate address
      if (
        addressBook.some((entry) => entry.address.toLowerCase() === trimmedAddress.toLowerCase())
      ) {
        // Update the nickname if address exists
        setAddressBook((prev) =>
          prev.map((entry) =>
            entry.address.toLowerCase() === trimmedAddress.toLowerCase()
              ? { ...entry, nickname: trimmedNickname }
              : entry
          )
        );
        return true;
      }

      // Enforce max 50 entries
      if (addressBook.length >= 50) {
        // Remove the oldest entry (first one) to make space
        setAddressBook((prev) => [...prev.slice(1), validation.entry!]);
        return true;
      }

      setAddressBook((prev) => [...prev, validation.entry!]);
      return true;
    },
    [addressBook]
  );

  const updateAddress = useCallback(
    (id: string, updates: Partial<Omit<AddressBookEntry, 'id'>>) => {
      setAddressBook((prev) =>
        prev.map((entry) => {
          if (entry.id !== id) return entry;
          const updated = {
            ...entry,
            ...(updates.address ? { address: updates.address.trim() } : {}),
            ...(updates.nickname ? { nickname: updates.nickname.trim() } : {}),
          };
          const validation = validateAddressBookEntry(updated);
          return validation.valid && validation.entry ? validation.entry : entry;
        })
      );
    },
    []
  );

  const deleteAddress = useCallback((id: string) => {
    setAddressBook((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const searchAddresses = useCallback(
    (query: string): AddressBookEntry[] => {
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

  const clearCorruptedState = useCallback(() => {
    if (!walletAddress) return;
    skipNextSaveRef.current = true;
    const storageKey = `${ADDRESS_BOOK_STORAGE_PREFIX}${walletAddress}`;
    storage.removeItem(storageKey);
    setAddressBook([]);
    setError(null);
    setValidationIssues(null);
  }, [walletAddress, storage]);

  return {
    addressBook,
    addAddress,
    updateAddress,
    deleteAddress,
    searchAddresses,
    isLoading,
    isDegraded,
    error,
    validationIssues,
    retryHydration: loadAndHydrate,
    clearCorruptedState,
  };
}
