/**
 * useAddressBook hook tests — encryption-aware
 *
 * Covers:
 *  - #863  addAddress / updateAddress validate Stellar address format and
 *          reject duplicates with typed error codes
 *  - #864  addAddress / updateAddress return PERSIST_FAILED and do NOT
 *          commit state when localStorage.setItem throws
 *  - #1086 entries are encrypted at rest (AES-GCM); wallet isolation verified;
 *          legacy plaintext data is migrated transparently on first load;
 *          corrupt/undecryptable data surfaces DECRYPT_FAILED
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useAddressBook from '../useAddressBook';
import { serializeAddressBookEnvelope, resetStorageStatus } from '@/utils/walletStorage';

// vi.mock is hoisted above module-level consts, so the address is hoisted too.
const { TEST_WALLET, OTHER_WALLET } = vi.hoisted(() => ({
  TEST_WALLET: 'GDCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXABCD',
  OTHER_WALLET: 'GOTHERWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXWXYZ',
}));

let mockWalletAddress: string | null = TEST_WALLET;

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({
    address: mockWalletAddress,
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
      { id: '1', address: ADDR_A, nickname: 'Test 1' },
      { id: '2', address: ADDR_B, nickname: 'Test 2' },
    ];
    const encrypted = await encryptForStorage(key, testEntries);
    localStorage.setItem(`iln-address-book-${TEST_WALLET}`, encrypted);

    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

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
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.addressBook).toHaveLength(0);
    expect(result.current.loadError).toBeNull();
  });

  // ── Legacy plaintext migration ────────────────────────────────────────────

  it('migrates legacy plaintext JSON to encrypted format on first load', async () => {
    const legacy = [
      { id: '1', address: ADDR_A, nickname: 'Legacy Entry' },
    ];
    // Store as raw JSON (pre-encryption format).
    localStorage.setItem(`iln-address-book-${TEST_WALLET}`, JSON.stringify(legacy));

    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Data is loaded correctly.
    expect(result.current.addressBook).toHaveLength(1);
    expect(result.current.addressBook[0].nickname).toBe('Legacy Entry');

    // Storage should now be encrypted.
    const raw = localStorage.getItem(`iln-address-book-${TEST_WALLET}`)!;
    expect(raw).not.toContain('Legacy Entry');
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('iv');
    expect(parsed).toHaveProperty('ct');
  });

  // ── Corrupt / undecryptable data ──────────────────────────────────────────

  it('surfaces DECRYPT_FAILED and returns an empty book for corrupt data', async () => {
    localStorage.setItem(`iln-address-book-${TEST_WALLET}`, '{"iv":"bad","ct":"data"}');

    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.addressBook).toHaveLength(0);
    expect(result.current.loadError).toBe('DECRYPT_FAILED');
  });

  it('surfaces DECRYPT_FAILED for fully unparseable junk in storage', async () => {
    localStorage.setItem(`iln-address-book-${TEST_WALLET}`, 'not-json-at-all!!!');

    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.addressBook).toHaveLength(0);
    expect(result.current.loadError).toBe('DECRYPT_FAILED');
  });

  it('clears the address book when wallet disconnects', async () => {
    const key = await deriveKeyFromWalletAddress(TEST_WALLET);
    const entries = [{ id: '1', address: ADDR_A, nickname: 'Test' }];
    localStorage.setItem(
      `iln-address-book-${TEST_WALLET}`,
      await encryptForStorage(key, entries)
    );

    const { result, rerender } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.addressBook).toHaveLength(1);

    // Disconnect wallet.
    act(() => {
      mockWalletAddress = null;
    });
    rerender();
    await waitFor(() => expect(result.current.addressBook).toHaveLength(0));
  });

  // ── addAddress — success ──────────────────────────────────────────────────

  it('adds new address to address book and returns ok:true', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let addResult: Awaited<ReturnType<typeof result.current.addAddress>>;
    await act(async () => {
      addResult = await result.current.addAddress(ADDR_A, 'Acme Corp');
    });

    expect(addResult!).toEqual({ ok: true });
    expect(result.current.addressBook).toHaveLength(1);
    expect(result.current.addressBook[0]).toMatchObject({
      address: ADDR_A,
      nickname: 'Acme Corp',
    });

    // Verify it's saved to localStorage as versioned envelope
    const stored = localStorage.getItem(`iln-address-book-${TEST_WALLET}`);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.version).toBe(1);
    expect(parsed.walletAddress).toBe(TEST_WALLET);
    expect(parsed.data).toHaveLength(1);
  });

  // ── addAddress — validation (#863) ───────────────────────────────────────

  it('rejects empty fields with MISSING_FIELDS', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let r1: Awaited<ReturnType<typeof result.current.addAddress>>;
    let r2: Awaited<ReturnType<typeof result.current.addAddress>>;
    await act(async () => {
      r1 = await result.current.addAddress('', 'Nick');
    });
    await act(async () => {
      r2 = await result.current.addAddress(ADDR_A, '');
    });

    expect(r1!).toEqual({ ok: false, error: 'MISSING_FIELDS' });
    expect(r2!).toEqual({ ok: false, error: 'MISSING_FIELDS' });
    expect(result.current.addressBook).toHaveLength(0);
  });

  it('rejects a malformed Stellar address with INVALID_ADDRESS', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let r: Awaited<ReturnType<typeof result.current.addAddress>>;
    await act(async () => {
      r = await result.current.addAddress('BADADDRESS', 'Test');
    });

    expect(r!).toEqual({ ok: false, error: 'INVALID_ADDRESS' });
    expect(result.current.addressBook).toHaveLength(0);
  });

  it('rejects an address starting with A (not G) with INVALID_ADDRESS', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const notStellar = 'A' + ADDR_A.slice(1);

    let r: Awaited<ReturnType<typeof result.current.addAddress>>;
    await act(async () => {
      r = await result.current.addAddress(notStellar, 'Test');
    });

    expect(r!).toEqual({ ok: false, error: 'INVALID_ADDRESS' });
  });

  it('rejects a duplicate address with DUPLICATE_ADDRESS', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addAddress(ADDR_A, 'First');
    });

    let r: Awaited<ReturnType<typeof result.current.addAddress>>;
    await act(async () => {
      r = await result.current.addAddress(ADDR_A, 'Second');
    });

    expect(r!).toEqual({ ok: false, error: 'DUPLICATE_ADDRESS' });
    expect(result.current.addressBook).toHaveLength(1);
    expect(result.current.addressBook[0].nickname).toBe('First');
  });

  // ── addAddress — capacity ─────────────────────────────────────────────────

  it('enforces maximum 50 entries by evicting the oldest', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    for (let i = 0; i < 51; i++) {
      await act(async () => {
        await result.current.addAddress(makeAddr(i), `Contact ${i}`);
      });
    }

    expect(result.current.addressBook).toHaveLength(50);
    expect(result.current.addressBook[0].address).toBe('GADDRESS1');
    expect(result.current.addressBook[49].address).toBe('GADDRESS50');
  });

  // ── addAddress — persist failure (#864) ──────────────────────────────────

  it('returns PERSIST_FAILED and does not commit state when localStorage throws on add', async () => {
    const realLocalStorage = window.localStorage;
    const throwingStorage = {
      ...realLocalStorage,
      getItem: (k: string) => realLocalStorage.getItem(k),
      setItem: (_k: string, _v: string) => {
        throw new DOMException('QuotaExceededError');
      },
      removeItem: (k: string) => realLocalStorage.removeItem(k),
      clear: () => realLocalStorage.clear(),
      length: 0,
      key: (_i: number) => null,
    };
    vi.stubGlobal('localStorage', throwingStorage);

    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let r: Awaited<ReturnType<typeof result.current.addAddress>>;
    await act(async () => {
      r = await result.current.addAddress(ADDR_A, 'Acme');
    });

    vi.unstubAllGlobals();

    expect(r!).toEqual({ ok: false, error: 'PERSIST_FAILED' });
    expect(result.current.addressBook).toHaveLength(0);
  });

  // ── deleteAddress ─────────────────────────────────────────────────────────

  it('deletes address from address book', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addAddress(ADDR_A, 'Contact 1');
    });
    await act(async () => {
      await result.current.addAddress(ADDR_B, 'Contact 2');
    });
    expect(result.current.addressBook).toHaveLength(2);

    await act(async () => {
      await result.current.deleteAddress(result.current.addressBook[0].id);
    });

    expect(result.current.addressBook).toHaveLength(1);
    expect(result.current.addressBook[0].address).toBe(ADDR_B);
  });

  // ── updateAddress — success (#862 regression) ────────────────────────────

  it('updateAddress persists the new values encrypted and returns ok:true', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addAddress(ADDR_A, 'Original');
    });

    const id = result.current.addressBook[0].id;
    let r: Awaited<ReturnType<typeof result.current.updateAddress>>;
    await act(async () => {
      r = await result.current.updateAddress(id, { nickname: 'Updated' });
    });

    expect(r!).toEqual({ ok: true });
    expect(result.current.addressBook[0].nickname).toBe('Updated');

    // Verify localStorage reflects the new encrypted value.
    const raw = localStorage.getItem(`iln-address-book-${TEST_WALLET}`)!;
    const key = await deriveKeyFromWalletAddress(TEST_WALLET);
    const dec = await decryptFromStorage<typeof result.current.addressBook>(key, raw);
    expect(dec![0].nickname).toBe('Updated');
  });

  // ── updateAddress — validation (#863) ────────────────────────────────────

  it('updateAddress rejects a malformed address with INVALID_ADDRESS', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addAddress(ADDR_A, 'Original');
    });

    const id = result.current.addressBook[0].id;
    let r: Awaited<ReturnType<typeof result.current.updateAddress>>;
    await act(async () => {
      r = await result.current.updateAddress(id, { address: 'BADFORMAT' });
    });

    expect(r!).toEqual({ ok: false, error: 'INVALID_ADDRESS' });
    expect(result.current.addressBook[0].address).toBe(ADDR_A);
  });

  it('updateAddress rejects a collision with another entry with DUPLICATE_ADDRESS', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addAddress(ADDR_A, 'Alice');
    });
    await act(async () => {
      await result.current.addAddress(ADDR_B, 'Bob');
    });

    const aliceId = result.current.addressBook[0].id;
    let r: Awaited<ReturnType<typeof result.current.updateAddress>>;
    await act(async () => {
      r = await result.current.updateAddress(aliceId, { address: ADDR_B });
    });

    expect(r!).toEqual({ ok: false, error: 'DUPLICATE_ADDRESS' });
    expect(result.current.addressBook[0].address).toBe(ADDR_A);
  });

  it('updateAddress allows keeping the same address on the same entry (no self-collision)', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addAddress(ADDR_A, 'Alice');
    });

    const id = result.current.addressBook[0].id;
    let r: Awaited<ReturnType<typeof result.current.updateAddress>>;
    await act(async () => {
      r = await result.current.updateAddress(id, { address: ADDR_A, nickname: 'Alice Renamed' });
    });

    expect(r!).toEqual({ ok: true });
    expect(result.current.addressBook[0].nickname).toBe('Alice Renamed');
  });

  // ── updateAddress — persist failure (#864) ───────────────────────────────

  it('returns PERSIST_FAILED and does NOT update state when localStorage throws on update', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addAddress(ADDR_A, 'Original');
    });

    const id = result.current.addressBook[0].id;

    const realLocalStorage = window.localStorage;
    const throwingStorage = {
      ...realLocalStorage,
      getItem: (k: string) => realLocalStorage.getItem(k),
      setItem: (_k: string, _v: string) => {
        throw new DOMException('QuotaExceededError');
      },
      removeItem: (k: string) => realLocalStorage.removeItem(k),
      clear: () => realLocalStorage.clear(),
      length: 0,
      key: (_i: number) => null,
    };
    vi.stubGlobal('localStorage', throwingStorage);

    let r: Awaited<ReturnType<typeof result.current.updateAddress>>;
    await act(async () => {
      r = await result.current.updateAddress(id, { nickname: 'Should Not Persist' });
    });

    vi.unstubAllGlobals();

    expect(r!).toEqual({ ok: false, error: 'PERSIST_FAILED' });
    expect(result.current.addressBook[0].nickname).toBe('Original');
  });

  // ── searchAddresses ───────────────────────────────────────────────────────

  it('searches addresses by nickname and address (case-insensitive)', async () => {
    const { result } = renderHook(() => useAddressBook());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addAddress(ADDR_A, 'Acme Corp');
    });
    await act(async () => {
      await result.current.addAddress(ADDR_B, 'Beta LLC');
    });
    await act(async () => {
      await result.current.addAddress(ADDR_C, 'Charlie Inc');
    });

    expect(result.current.searchAddresses('Acme')).toHaveLength(1);
    expect(result.current.searchAddresses('acme')).toHaveLength(1);
    expect(result.current.searchAddresses('BBBB')).toHaveLength(1);
    expect(result.current.searchAddresses('XYZ')).toHaveLength(0);
    expect(result.current.searchAddresses('')).toHaveLength(3);
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
