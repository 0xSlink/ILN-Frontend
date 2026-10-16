import { useState, useCallback, useEffect, useRef } from 'react';
import { useWallet } from '@/context/WalletContext';

interface AddressBookEntry {
  id: string;
  address: string;
  nickname: string;
}

const STORAGE_KEY_PREFIX = 'iln-address-book-';

// Date.now() alone collides for entries created within the same millisecond,
// which made deleteAddress() remove every entry added in the same tick.
function createEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
    if (!walletAddress) return;

    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${walletAddress}`, JSON.stringify(addressBook));
    } catch (e) {
      console.error('Failed to persist address book to localStorage', e);
    }
  }, [addressBook, walletAddress]);

  const addAddress = useCallback(
    (address: string, nickname: string) => {
      if (!address || !nickname) return;
      // Check for duplicate address
      if (addressBook.some((entry) => entry.address === address)) {
        // Update the nickname if address exists
        setAddressBook(
          addressBook.map((entry) => (entry.address === address ? { ...entry, nickname } : entry))
        );
        return;
      }
      // Enforce max 50 entries
      if (addressBook.length >= 50) {
        // Remove the oldest entry (first one) to make space
        setAddressBook((prev) => [...prev.slice(1), { id: createEntryId(), address, nickname }]);
        return;
      }
      setAddressBook((prev) => [...prev, { id: createEntryId(), address, nickname }]);
    },
    [addressBook]
  );

  const updateAddress = useCallback(
    (id: string, updates: Partial<Omit<AddressBookEntry, 'id'>>) => {
      setAddressBook((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry))
      );
    },
    []
  );

  const deleteAddress = useCallback((id: string) => {
    setAddressBook((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

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
