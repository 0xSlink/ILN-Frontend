import { renderHook, act } from '@testing-library/react';
import { useWatchlist } from '@/hooks/useWatchlist';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// The hook surfaces limit warnings through the toast context.
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn(() => 'toast-id'), updateToast: vi.fn() }),
}));

describe('useWatchlist', () => {
  const walletAddress = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with an empty watchlist', () => {
    const { result } = renderHook(() => useWatchlist(walletAddress));
    expect(result.current.watchlist).toEqual([]);
  });

  it('should add an invoice to the watchlist', () => {
    const { result } = renderHook(() => useWatchlist(walletAddress));

    act(() => {
      result.current.addToWatchlist(1n);
    });

    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0].id).toBe('1');
    expect(result.current.watchlist[0].addedAt).toBeDefined();

    // Check localStorage
    const stored = JSON.parse(localStorage.getItem(`watchlist_${walletAddress}`) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('1');
  });

  it('should remove an invoice from the watchlist', () => {
    const { result } = renderHook(() => useWatchlist(walletAddress));

    act(() => {
      result.current.addToWatchlist(1n);
      result.current.addToWatchlist(2n);
    });

    expect(result.current.watchlist).toHaveLength(2);

    act(() => {
      result.current.removeFromWatchlist(1n);
    });

    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0].id).toBe('2');
  });

  it('should toggle an invoice in the watchlist', () => {
    const { result } = renderHook(() => useWatchlist(walletAddress));

    act(() => {
      result.current.toggleWatchlist(1n);
    });

    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0].id).toBe('1');

    act(() => {
      result.current.toggleWatchlist(1n);
    });

    expect(result.current.watchlist).toHaveLength(0);
  });

  it('should check if an invoice is in the watchlist', () => {
    const { result } = renderHook(() => useWatchlist(walletAddress));

    act(() => {
      result.current.addToWatchlist(1n);
    });

    expect(result.current.isInWatchlist(1n)).toBe(true);
    expect(result.current.isInWatchlist(2n)).toBe(false);
  });

  it('should enforce the maximum watchlist limit of 50', () => {
    const { result } = renderHook(() => useWatchlist(walletAddress));

    // Fill up to the limit
    act(() => {
      for (let i = 1; i <= 50; i++) {
        result.current.addToWatchlist(BigInt(i));
      }
    });

    expect(result.current.watchlist).toHaveLength(50);

    // Try to add the 51st item
    expect(() => {
      act(() => {
        result.current.addToWatchlist(51n);
      });
    }).toThrow(
      'Watchlist limit of 50 invoices reached. Please remove some before adding new ones.'
    );

    // Still at 50
    expect(result.current.watchlist).toHaveLength(50);
  });

  it('should maintain separate watchlists for different wallet addresses', () => {
    const address1 = 'GABC123';
    const address2 = 'GDEF456';

    const { result: result1 } = renderHook(() => useWatchlist(address1));
    const { result: result2 } = renderHook(() => useWatchlist(address2));

    act(() => {
      result1.current.addToWatchlist(1n);
    });

    expect(result1.current.watchlist).toHaveLength(1);
    expect(result2.current.watchlist).toHaveLength(0);
  });
});
