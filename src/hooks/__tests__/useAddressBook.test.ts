/**
 * useAddressBook hook tests
 *
 * Covers:
 *  - #863  addAddress / updateAddress validate Stellar address format and
 *          reject duplicates with typed error codes
 *  - #864  addAddress / updateAddress return PERSIST_FAILED and do NOT
 *          commit state when localStorage.setItem throws
 */
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useAddressBook from '../useAddressBook';

// vi.mock is hoisted above module-level consts, so the address is hoisted too.
const { TEST_WALLET } = vi.hoisted(() => ({
  TEST_WALLET: 'GDCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXABCD',
}));

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({
    address: TEST_WALLET,
  }),
}));

// ── Valid 56-char Stellar addresses (G + [A-Z2-7]{55}) ───────────────────────

const ADDR_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABC';
const ADDR_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBD';
const ADDR_C = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBE';

/**
 * Build a valid 56-char Stellar address from an index 0–999.
 * Pattern: G + 52 'A's + 3-digit zero-padded index (digits 2-7 only → use
 * the base-32 charset where 0→A, 1→B, …, 9→J  isn't Stellar charset;
 * we simply use the letters A-Z + 2-7 and pick distinct combos per index).
 * Easier: just vary the last 3 chars using A-Z only (26^3 = 17576 > 999).
 */
function makeAddr(i: number): string {
  const c1 = String.fromCharCode(65 + (Math.floor(i / (26 * 26)) % 26));
  const c2 = String.fromCharCode(65 + (Math.floor(i / 26) % 26));
  const c3 = String.fromCharCode(65 + (i % 26));
  // G + 52 'A's + c1 + c2 + c3 = 56 chars total
  return 'G' + 'A'.repeat(52) + c1 + c2 + c3;
}

describe('useAddressBook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ── Load ──────────────────────────────────────────────────────────────────

  it('loads address book from localStorage', () => {
    const testEntries = [
      { id: '1', address: ADDR_A, nickname: 'Test 1' },
      { id: '2', address: ADDR_B, nickname: 'Test 2' },
    ];
    localStorage.setItem(`iln-address-book-${TEST_WALLET}`, JSON.stringify(testEntries));

    const { result } = renderHook(() => useAddressBook());

    expect(result.current.addressBook).toHaveLength(2);
    expect(result.current.addressBook[0].nickname).toBe('Test 1');
  });

  // ── addAddress — success ──────────────────────────────────────────────────

  it('adds new address to address book and returns ok:true', () => {
    const { result } = renderHook(() => useAddressBook());

    let addResult: ReturnType<typeof result.current.addAddress>;
    act(() => {
      addResult = result.current.addAddress(ADDR_A, 'Acme Corp');
    });

    expect(addResult!).toEqual({ ok: true });
    expect(result.current.addressBook).toHaveLength(1);
    expect(result.current.addressBook[0]).toMatchObject({
      address: ADDR_A,
      nickname: 'Acme Corp',
    });

    // Verify persisted to localStorage
    const stored = localStorage.getItem(`iln-address-book-${TEST_WALLET}`);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toHaveLength(1);
  });

  // ── addAddress — validation (#863) ───────────────────────────────────────

  it('rejects empty fields with MISSING_FIELDS', () => {
    const { result } = renderHook(() => useAddressBook());

    let r1: ReturnType<typeof result.current.addAddress>;
    let r2: ReturnType<typeof result.current.addAddress>;
    act(() => {
      r1 = result.current.addAddress('', 'Nick');
    });
    act(() => {
      r2 = result.current.addAddress(ADDR_A, '');
    });

    expect(r1!).toEqual({ ok: false, error: 'MISSING_FIELDS' });
    expect(r2!).toEqual({ ok: false, error: 'MISSING_FIELDS' });
    expect(result.current.addressBook).toHaveLength(0);
  });

  it('rejects a malformed Stellar address with INVALID_ADDRESS', () => {
    const { result } = renderHook(() => useAddressBook());

    let r: ReturnType<typeof result.current.addAddress>;
    act(() => {
      r = result.current.addAddress('BADADDRESS', 'Test');
    });

    expect(r!).toEqual({ ok: false, error: 'INVALID_ADDRESS' });
    expect(result.current.addressBook).toHaveLength(0);
  });

  it('rejects an address starting with A (not G) with INVALID_ADDRESS', () => {
    const { result } = renderHook(() => useAddressBook());
    const notStellar = 'A' + ADDR_A.slice(1); // starts with A, not G

    let r: ReturnType<typeof result.current.addAddress>;
    act(() => {
      r = result.current.addAddress(notStellar, 'Test');
    });

    expect(r!).toEqual({ ok: false, error: 'INVALID_ADDRESS' });
  });

  it('rejects a duplicate address with DUPLICATE_ADDRESS', () => {
    const { result } = renderHook(() => useAddressBook());

    act(() => {
      result.current.addAddress(ADDR_A, 'First');
    });

    let r: ReturnType<typeof result.current.addAddress>;
    act(() => {
      r = result.current.addAddress(ADDR_A, 'Second');
    });

    expect(r!).toEqual({ ok: false, error: 'DUPLICATE_ADDRESS' });
    // State unchanged — still one entry, nickname not silently swapped
    expect(result.current.addressBook).toHaveLength(1);
    expect(result.current.addressBook[0].nickname).toBe('First');
  });

  // ── addAddress — capacity ─────────────────────────────────────────────────

  it('enforces maximum 50 entries by evicting the oldest', () => {
    const { result } = renderHook(() => useAddressBook());

    // Each addAddress needs its own act() so it sees the updated state from
    // the previous call (the callback closes over the current addressBook).
    for (let i = 0; i < 51; i++) {
      act(() => {
        result.current.addAddress(makeAddr(i), `Contact ${i}`);
      });
    }

    expect(result.current.addressBook).toHaveLength(50);
    // Contact 0 (the oldest) should have been evicted
    expect(result.current.addressBook[0].nickname).toBe('Contact 1');
    expect(result.current.addressBook[49].nickname).toBe('Contact 50');
  });

  // ── addAddress — persist failure (#864) ──────────────────────────────────

  it('returns PERSIST_FAILED and does not commit state when localStorage throws on add', () => {
    // jsdom's localStorage is an instance on window; stub the whole object so
    // setItem throws regardless of how it is called inside the hook.
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

    let r: ReturnType<typeof result.current.addAddress>;
    act(() => {
      r = result.current.addAddress(ADDR_A, 'Acme');
    });

    vi.unstubAllGlobals();

    expect(r!).toEqual({ ok: false, error: 'PERSIST_FAILED' });
    // State must NOT have been updated — UI stays consistent with disk
    expect(result.current.addressBook).toHaveLength(0);
  });

  // ── deleteAddress ─────────────────────────────────────────────────────────

  it('deletes address from address book', () => {
    const { result } = renderHook(() => useAddressBook());

    // Separate act() calls so each sees the updated state
    act(() => {
      result.current.addAddress(ADDR_A, 'Contact 1');
    });
    act(() => {
      result.current.addAddress(ADDR_B, 'Contact 2');
    });
    expect(result.current.addressBook).toHaveLength(2);

    act(() => {
      result.current.deleteAddress(result.current.addressBook[0].id);
    });

    expect(result.current.addressBook).toHaveLength(1);
    expect(result.current.addressBook[0].address).toBe(ADDR_B);
  });

  // ── updateAddress — success (#862 regression) ────────────────────────────

  it('updateAddress persists the new values and returns ok:true', () => {
    const { result } = renderHook(() => useAddressBook());

    act(() => {
      result.current.addAddress(ADDR_A, 'Original');
    });

    const id = result.current.addressBook[0].id;
    let r: ReturnType<typeof result.current.updateAddress>;
    act(() => {
      r = result.current.updateAddress(id, { nickname: 'Updated' });
    });

    expect(r!).toEqual({ ok: true });
    expect(result.current.addressBook[0].nickname).toBe('Updated');

    // Verify localStorage reflects the new value
    const stored = JSON.parse(localStorage.getItem(`iln-address-book-${TEST_WALLET}`)!);
    expect(stored[0].nickname).toBe('Updated');
  });

  // ── updateAddress — validation (#863) ────────────────────────────────────

  it('updateAddress rejects a malformed address with INVALID_ADDRESS', () => {
    const { result } = renderHook(() => useAddressBook());

    act(() => {
      result.current.addAddress(ADDR_A, 'Original');
    });

    const id = result.current.addressBook[0].id;
    let r: ReturnType<typeof result.current.updateAddress>;
    act(() => {
      r = result.current.updateAddress(id, { address: 'BADFORMAT' });
    });

    expect(r!).toEqual({ ok: false, error: 'INVALID_ADDRESS' });
    // State unchanged
    expect(result.current.addressBook[0].address).toBe(ADDR_A);
  });

  it('updateAddress rejects a collision with another entry with DUPLICATE_ADDRESS', () => {
    const { result } = renderHook(() => useAddressBook());

    act(() => {
      result.current.addAddress(ADDR_A, 'Alice');
    });
    act(() => {
      result.current.addAddress(ADDR_B, 'Bob');
    });

    const aliceId = result.current.addressBook[0].id;
    let r: ReturnType<typeof result.current.updateAddress>;
    act(() => {
      // Try to set Alice's address to Bob's address
      r = result.current.updateAddress(aliceId, { address: ADDR_B });
    });

    expect(r!).toEqual({ ok: false, error: 'DUPLICATE_ADDRESS' });
    expect(result.current.addressBook[0].address).toBe(ADDR_A);
  });

  it('updateAddress allows keeping the same address on the same entry (no self-collision)', () => {
    const { result } = renderHook(() => useAddressBook());

    act(() => {
      result.current.addAddress(ADDR_A, 'Alice');
    });

    const id = result.current.addressBook[0].id;
    let r: ReturnType<typeof result.current.updateAddress>;
    act(() => {
      r = result.current.updateAddress(id, { address: ADDR_A, nickname: 'Alice Renamed' });
    });

    expect(r!).toEqual({ ok: true });
    expect(result.current.addressBook[0].nickname).toBe('Alice Renamed');
  });

  // ── updateAddress — persist failure (#864) ───────────────────────────────

  it('returns PERSIST_FAILED and does NOT update state when localStorage throws on update', () => {
    const { result } = renderHook(() => useAddressBook());

    act(() => {
      result.current.addAddress(ADDR_A, 'Original');
    });

    const id = result.current.addressBook[0].id;

    // Stub localStorage so setItem throws on the update call
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

    let r: ReturnType<typeof result.current.updateAddress>;
    act(() => {
      r = result.current.updateAddress(id, { nickname: 'Should Not Persist' });
    });

    vi.unstubAllGlobals();

    expect(r!).toEqual({ ok: false, error: 'PERSIST_FAILED' });
    // In-memory state must NOT change — UI stays consistent with disk
    expect(result.current.addressBook[0].nickname).toBe('Original');
  });

  // ── searchAddresses ───────────────────────────────────────────────────────

  it('searches addresses by nickname and address (case-insensitive)', () => {
    const { result } = renderHook(() => useAddressBook());

    // Each addAddress in its own act() to avoid stale-closure issues
    act(() => {
      result.current.addAddress(ADDR_A, 'Acme Corp');
    });
    act(() => {
      result.current.addAddress(ADDR_B, 'Beta LLC');
    });
    act(() => {
      result.current.addAddress(ADDR_C, 'Charlie Inc');
    });

    expect(result.current.searchAddresses('Acme')).toHaveLength(1);
    expect(result.current.searchAddresses('acme')).toHaveLength(1);
    // ADDR_B contains 'BBBB' in its string
    expect(result.current.searchAddresses('BBBB')).toHaveLength(1);
    expect(result.current.searchAddresses('XYZ')).toHaveLength(0);
    expect(result.current.searchAddresses('')).toHaveLength(3);
  });
});
