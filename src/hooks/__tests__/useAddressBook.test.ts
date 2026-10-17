import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useAddressBook from '../useAddressBook';
import { serializeAddressBookEnvelope, resetStorageStatus } from '@/utils/walletStorage';

// vi.mock is hoisted above module-level consts, so the address is hoisted too.
const { TEST_WALLET, OTHER_WALLET } = vi.hoisted(() => ({
  TEST_WALLET: 'GDCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXABCD',
  OTHER_WALLET: 'GOTHERWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXWXYZ',
}));

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({
    address: TEST_WALLET,
  }),
}));

describe('useAddressBook (wave-9)', () => {
  beforeEach(() => {
    // Clear localStorage and reset storage status before each test
    localStorage.clear();
    resetStorageStatus();
  });

  it('loads legacy address book from localStorage and migrates to v1 envelope', () => {
    // Pre-populate localStorage with legacy unversioned array (v0)
    const testEntries = [
      { id: '1', address: 'GADDRESS1', nickname: 'Test 1' },
      { id: '2', address: 'GADDRESS2', nickname: 'Test 2' },
    ];
    localStorage.setItem(`iln-address-book-${TEST_WALLET}`, JSON.stringify(testEntries));

    const { result } = renderHook(() => useAddressBook());

    expect(result.current.addressBook).toHaveLength(2);
    expect(result.current.addressBook[0].nickname).toBe('Test 1');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    // Verify it was migrated to a version 1 envelope in storage
    const stored = localStorage.getItem(`iln-address-book-${TEST_WALLET}`);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.version).toBe(1);
    expect(parsed.walletAddress).toBe(TEST_WALLET);
    expect(parsed.data).toHaveLength(2);
  });

  it('adds new address to address book and persists versioned envelope', () => {
    const { result } = renderHook(() => useAddressBook());

    act(() => {
      result.current.addAddress('GNEWADDRESS', 'New Contact');
    });

    expect(result.current.addressBook).toHaveLength(1);
    expect(result.current.addressBook[0]).toMatchObject({
      address: 'GNEWADDRESS',
      nickname: 'New Contact',
    });

    // Verify it's saved to localStorage as versioned envelope
    const stored = localStorage.getItem(`iln-address-book-${TEST_WALLET}`);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.version).toBe(1);
    expect(parsed.walletAddress).toBe(TEST_WALLET);
    expect(parsed.data).toHaveLength(1);
  });

  it('prevents duplicate addresses and updates nickname', () => {
    const { result } = renderHook(() => useAddressBook());

    // Add first address
    act(() => {
      result.current.addAddress('GSAMEADDRESS', 'First Nickname');
    });

    // Try to add same address with different nickname
    act(() => {
      result.current.addAddress('GSAMEADDRESS', 'Updated Nickname');
    });

    expect(result.current.addressBook).toHaveLength(1);
    expect(result.current.addressBook[0].nickname).toBe('Updated Nickname');
  });

  it('enforces maximum 50 entries', () => {
    const { result } = renderHook(() => useAddressBook());

    // Add 51 entries
    for (let i = 0; i < 51; i++) {
      act(() => {
        result.current.addAddress(`GADDRESS${i}`, `Contact ${i}`);
      });
    }

    // Should only have 50 entries (oldest removed)
    expect(result.current.addressBook).toHaveLength(50);
    expect(result.current.addressBook[0].address).toBe('GADDRESS1');
    expect(result.current.addressBook[49].address).toBe('GADDRESS50');
  });

  it('deletes address from address book', () => {
    const { result } = renderHook(() => useAddressBook());

    // Add two addresses
    act(() => {
      result.current.addAddress('GADDRESS1', 'Contact 1');
      result.current.addAddress('GADDRESS2', 'Contact 2');
    });

    expect(result.current.addressBook).toHaveLength(2);

    // Delete first address
    act(() => {
      result.current.deleteAddress(result.current.addressBook[0].id);
    });

    expect(result.current.addressBook).toHaveLength(1);
    expect(result.current.addressBook[0].address).toBe('GADDRESS2');
  });

  it('searches addresses by nickname and address', () => {
    const { result } = renderHook(() => useAddressBook());

    // Add test addresses
    act(() => {
      result.current.addAddress(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABC',
        'Acme Corp'
      );
      result.current.addAddress(
        'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBD',
        'Beta LLC'
      );
      result.current.addAddress(
        'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBE',
        'Charlie Inc'
      );
    });

    // Search by nickname
    let results = result.current.searchAddresses('Acme');
    expect(results).toHaveLength(1);
    expect(results[0].nickname).toBe('Acme Corp');

    // Search by address (partial)
    results = result.current.searchAddresses('BBBB');
    expect(results).toHaveLength(1);
    expect(results[0].address).toBe('GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBD');

    // Search case insensitive
    results = result.current.searchAddresses('acme');
    expect(results).toHaveLength(1);

    // Search with no matches
    results = result.current.searchAddresses('XYZ');
    expect(results).toHaveLength(0);

    // Empty search returns all
    results = result.current.searchAddresses('');
    expect(results).toHaveLength(3);
  });

  describe('Wallet/Network Isolation & Ownership Verification', () => {
    it('rejects hydration when stored envelope belongs to another wallet address', () => {
      // Store envelope tagged with OTHER_WALLET under current wallet's key
      const wrongWalletEnvelope = serializeAddressBookEnvelope(
        [{ id: 'entry-1', address: 'GADDRESS1', nickname: 'Stolen Contact' }],
        OTHER_WALLET
      );
      localStorage.setItem(`iln-address-book-${TEST_WALLET}`, wrongWalletEnvelope);

      const { result } = renderHook(() => useAddressBook());

      expect(result.current.addressBook).toHaveLength(0);
      expect(result.current.error).toContain('Wallet ownership mismatch');
    });
  });

  describe('Validation & Malformed Entries', () => {
    it('rejects malformed records and entries with unknown fields without silently dropping valid entries', () => {
      const validEntry = { id: 'valid-1', address: 'GVALIDADDRESS', nickname: 'Valid Contact' };
      const envelopeWithBadData = {
        version: 1,
        walletAddress: TEST_WALLET,
        data: [
          validEntry,
          {
            id: 'bad-1',
            address: 'GGOODADDRESS',
            nickname: 'Bad Field',
            unauthorizedKey: 'attack',
          },
          { id: '', address: 'GINVALID', nickname: 'Empty ID' },
          null,
        ],
        updatedAt: Date.now(),
      };
      localStorage.setItem(`iln-address-book-${TEST_WALLET}`, JSON.stringify(envelopeWithBadData));

      const { result } = renderHook(() => useAddressBook());

      // Valid entry is preserved
      expect(result.current.addressBook).toHaveLength(1);
      expect(result.current.addressBook[0].nickname).toBe('Valid Contact');
      // Malformed entries are rejected with diagnostic tracking
      expect(result.current.validationIssues?.rejectedCount).toBe(3);
      expect(result.current.validationIssues?.reasons.length).toBe(3);
    });

    it('sets explicit error state on corrupt JSON and allows clearCorruptedState recovery', () => {
      localStorage.setItem(`iln-address-book-${TEST_WALLET}`, '{"broken json');

      const { result } = renderHook(() => useAddressBook());

      expect(result.current.error).toContain('invalid JSON');
      expect(result.current.addressBook).toHaveLength(0);

      // Perform recovery
      act(() => {
        result.current.clearCorruptedState();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.addressBook).toHaveLength(0);
      expect(localStorage.getItem(`iln-address-book-${TEST_WALLET}`)).toBeNull();
    });
  });

  describe('Degraded Mode & Storage Failures', () => {
    it('switches to degraded mode when localStorage setItem throws QuotaExceededError', () => {
      const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

      const { result } = renderHook(() => useAddressBook());

      act(() => {
        result.current.addAddress('GNEWADDRESS', 'Degraded Contact');
      });

      expect(result.current.isDegraded).toBe(true);
      expect(result.current.addressBook).toHaveLength(1);
      expect(result.current.addressBook[0].nickname).toBe('Degraded Contact');

      setItemSpy.mockRestore();
    });
  });
});
