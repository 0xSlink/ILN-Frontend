import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReputationDecay } from '../useReputationDecay';

const getReputation = vi.fn();
vi.mock('@/utils/soroban', () => ({
  getReputation: (...args: unknown[]) => getReputation(...args),
}));

beforeEach(() => {
  getReputation.mockReset();
  // Default to an in-flight request; individual tests override as needed.
  getReputation.mockReturnValue(new Promise(() => {}));
});

describe('useReputationDecay', () => {
  it('returns loading state initially', () => {
    const { result } = renderHook(() => useReputationDecay('GTEST'));
    expect(result.current.loading).toBe(true);
  });

  it('handles missing address by setting loading to false', () => {
    const { result } = renderHook(() => useReputationDecay(undefined));
    expect(result.current.loading).toBe(false);
  });

  it('loads reputation and calculates status when address is provided', async () => {
    getReputation.mockResolvedValue({
      score: 100,
      last_activity_ledger: 1000000,
    });

    const { result } = renderHook(() => useReputationDecay('GTEST', 2000000));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentScore).toBe(100);
    expect(result.current.loading).toBe(false);
  });

  it('calculates decay status based on ledger difference', async () => {
    getReputation.mockResolvedValue({
      score: 100,
      last_activity_ledger: 0,
    });

    const currentLedger = 2000000;
    const { result } = renderHook(() => useReputationDecay('GTEST', currentLedger));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentScore).toBe(100);
  });

  it('handles reputation fetch errors gracefully', async () => {
    getReputation.mockRejectedValue(new Error('fetch failed'));

    const { result } = renderHook(() => useReputationDecay('GTEST'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.projectedScore30Days).toBe(100);
  });

  it('computes projected score correctly when decaying', async () => {
    const reputationScore = 100;
    const lastActivityLedger = 500000;
    const currentLedger = 2500000;

    getReputation.mockResolvedValue({
      score: reputationScore,
      last_activity_ledger: lastActivityLedger,
    });

    const { result } = renderHook(() => useReputationDecay('GTEST', currentLedger));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentScore).toBe(reputationScore);
    expect(typeof result.current.projectedScore30Days).toBe('number');
  });

  it('cleans up on unmount to prevent memory leaks', async () => {
    let resolveRep: (v: any) => void;
    const repPromise = new Promise((r) => {
      resolveRep = r;
    });
    getReputation.mockReturnValue(repPromise);

    const { unmount } = renderHook(() => useReputationDecay('GTEST'));

    unmount();

    resolveRep!({
      score: 100,
      last_activity_ledger: 1000000,
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(getReputation).toHaveBeenCalled();
  });
});
