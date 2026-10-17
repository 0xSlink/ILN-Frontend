import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReputationDecay } from '../src/hooks/useReputationDecay';
import * as soroban from '../src/utils/soroban';

// Mock the soroban utility
vi.mock('../src/utils/soroban', () => ({
  getReputation: vi.fn(),
}));

describe('useReputationDecay', () => {
  const mockGetReputation = soroban.getReputation as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading state initially', () => {
    mockGetReputation.mockReturnValue(new Promise(() => {})); // Never resolves
    const { result } = renderHook(() => useReputationDecay('G123FV'));
    expect(result.current.loading).toBe(true);
  });

  it('does not decay if under threshold', async () => {
    mockGetReputation.mockResolvedValue({
      score: 100,
      last_activity_ledger: 100_000,
    });

    // threshold is 1,555,200. Let's make currentLedger = 1_000_000
    const { result } = renderHook(() => useReputationDecay('G123FV', 1_000_000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isDecaying).toBe(false);
    expect(result.current.currentScore).toBe(100);
    // Even if not decaying now, we check if it will decay in 30 days (518,400 ledgers)
    // 1_000_000 - 100_000 = 900_000 (inactive length)
    // 900_000 + 518_400 = 1_418_400 (still under 1,555,200 threshold, no decay)
    expect(result.current.projectedScore30Days).toBe(100);
  });

  it('starts decaying if over threshold', async () => {
    mockGetReputation.mockResolvedValue({
      score: 100,
      last_activity_ledger: 100_000,
    });

    // Let's make currentLedger = 2_000_000 (inactive for 1,900,000 ledgers)
    // Over threshold of 1,555,200
    const { result } = renderHook(() => useReputationDecay('G123FV', 2_000_000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isDecaying).toBe(true);
    expect(result.current.currentScore).toBe(100);

    // Decay amount for 30 days (518,400 ledgers) at (1 / 518400) per ledger = 1 point
    expect(result.current.projectedScore30Days).toBe(99);
  });

  it('projects future decay if threshold will be crossed within 30 days', async () => {
    mockGetReputation.mockResolvedValue({
      score: 100,
      last_activity_ledger: 100_000,
    });

    // Let's make currentLedger = 1,400,000 (inactive for 1,300,000 ledgers)
    // In 30 days (+518,400), it will reach 1,818,400 which is > 1,555,200
    // So it will decay for (1,818,400 - 1,555,200) = 263,200 ledgers
    // Decay = 263,200 / 518,400 ≈ 0.5077
    const { result } = renderHook(() => useReputationDecay('G123FV', 1_400_000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isDecaying).toBe(false); // currently not decaying
    expect(result.current.currentScore).toBe(100);

    const decayAmount = 263_200 * (1 / 518_400);
    expect(result.current.projectedScore30Days).toBeCloseTo(100 - decayAmount, 3);
  });
});
