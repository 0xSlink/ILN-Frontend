import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWatchlist } from '../useWatchlist';

const getInvoiceMock = vi.fn();
vi.mock('@/utils/soroban', () => ({
  getInvoice: (...args: unknown[]) => getInvoiceMock(...args),
}));

const addToastMock = vi.fn();
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

describe('useWatchlist', () => {
  beforeEach(() => {
    localStorage.clear();
    getInvoiceMock.mockReset();
    getInvoiceMock.mockResolvedValue({ id: 1n, status: 'Pending' });
    addToastMock.mockClear();
    vi.useRealTimers();
  });

  it('starts empty when there is no connected wallet', () => {
    const { result } = renderHook(() => useWatchlist(null));
    expect(result.current.watchlist).toEqual([]);
  });

  it('loads a previously saved watchlist for the wallet', () => {
    const saved = [{ id: '5', addedAt: 1000 }];
    localStorage.setItem('watchlist_GLP1', JSON.stringify(saved));

    const { result } = renderHook(() => useWatchlist('GLP1'));
    expect(result.current.watchlist).toEqual(saved);
    expect(result.current.isInWatchlist(5n)).toBe(true);
    expect(result.current.isInWatchlist(6n)).toBe(false);
  });

  it('clears the list when loading corrupt JSON', () => {
    localStorage.setItem('watchlist_GLP1', '{not-json');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useWatchlist('GLP1'));
    expect(result.current.watchlist).toEqual([]);
    consoleError.mockRestore();
  });

  it('adds an invoice to the watchlist and persists it', () => {
    const { result } = renderHook(() => useWatchlist('GLP1'));

    act(() => result.current.addToWatchlist(42n));
    expect(result.current.watchlist.map((w) => w.id)).toEqual(['42']);
    const stored = JSON.parse(localStorage.getItem('watchlist_GLP1')!);
    expect(stored.map((w: any) => w.id)).toEqual(['42']);
  });

  it('does not add a duplicate invoice', () => {
    const { result } = renderHook(() => useWatchlist('GLP1'));
    act(() => result.current.addToWatchlist(42n));
    act(() => result.current.addToWatchlist(42n));
    expect(result.current.watchlist).toHaveLength(1);
  });

  it('throws once the watchlist reaches its size limit', () => {
    const saved = Array.from({ length: 50 }, (_, i) => ({ id: String(i), addedAt: i }));
    localStorage.setItem('watchlist_GLP1', JSON.stringify(saved));
    const { result } = renderHook(() => useWatchlist('GLP1'));

    expect(() => act(() => result.current.addToWatchlist(999n))).toThrow(/limit of 50/);
  });

  it('removes an invoice from the watchlist and persists it', () => {
    const { result } = renderHook(() => useWatchlist('GLP1'));
    act(() => result.current.addToWatchlist(42n));
    act(() => result.current.removeFromWatchlist(42n));

    expect(result.current.watchlist).toEqual([]);
    expect(JSON.parse(localStorage.getItem('watchlist_GLP1')!)).toEqual([]);
  });

  it('toggleWatchlist adds when absent and removes when present', () => {
    const { result } = renderHook(() => useWatchlist('GLP1'));

    act(() => result.current.toggleWatchlist(7n));
    expect(result.current.isInWatchlist(7n)).toBe(true);

    act(() => result.current.toggleWatchlist(7n));
    expect(result.current.isInWatchlist(7n)).toBe(false);
  });

  it('toggleWatchlist throws at the size limit when adding', () => {
    const saved = Array.from({ length: 50 }, (_, i) => ({ id: String(i), addedAt: i }));
    localStorage.setItem('watchlist_GLP1', JSON.stringify(saved));
    const { result } = renderHook(() => useWatchlist('GLP1'));

    expect(() => act(() => result.current.toggleWatchlist(999n))).toThrow(/limit of 50/);
  });

  it('clears the watchlist and stops polling when the wallet disconnects', () => {
    const { result, rerender } = renderHook(({ address }) => useWatchlist(address), {
      initialProps: { address: 'GLP1' as string | null },
    });
    act(() => result.current.addToWatchlist(1n));
    expect(result.current.watchlist).toHaveLength(1);

    rerender({ address: null });
    expect(result.current.watchlist).toEqual([]);
  });

  it('polls watched invoice statuses and toasts on a status change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const saved = [{ id: '3', addedAt: 1, lastKnownStatus: 'Pending' }];
    localStorage.setItem('watchlist_GLP1', JSON.stringify(saved));
    getInvoiceMock.mockResolvedValue({ id: 3n, status: 'Funded' });

    renderHook(() => useWatchlist('GLP1'));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Invoice #3 updated',
          message: 'Status changed from Pending to Funded',
        })
      );
    });

    vi.useRealTimers();
  });

  it('does not toast on the first poll when there is no previously known status', async () => {
    const saved = [{ id: '3', addedAt: 1 }];
    localStorage.setItem('watchlist_GLP1', JSON.stringify(saved));
    getInvoiceMock.mockResolvedValue({ id: 3n, status: 'Funded' });

    renderHook(() => useWatchlist('GLP1'));

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('watchlist_GLP1')!);
      expect(stored[0].lastKnownStatus).toBe('Funded');
    });
    expect(addToastMock).not.toHaveBeenCalled();
  });
});
