import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReferralStats } from '../useReferralStats';
import { QUERY_TIMINGS } from '../queries/keys';

const useQueryMock = vi.fn((config: any) => ({ data: undefined, __config: config }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: any) => useQueryMock(config),
}));

const { getReferralStatsMock } = vi.hoisted(() => ({ getReferralStatsMock: vi.fn() }));
vi.mock('@/utils/soroban', () => ({
  getReferralStats: getReferralStatsMock,
}));

describe('useReferralStats', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
    getReferralStatsMock.mockReset();
  });

  it('builds the query key from the referral code and applies the stats query timings', () => {
    renderHook(() => useReferralStats('ABC123'));
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual(['referral-stats', 'ABC123']);
    expect(config.refetchInterval).toBe(60_000);
    expect(config).toMatchObject(QUERY_TIMINGS.stats);
  });

  it('is disabled when the code is empty', () => {
    renderHook(() => useReferralStats(''));
    expect(useQueryMock.mock.calls[0][0].enabled).toBe(false);
  });

  it('is enabled when a code is provided and calls getReferralStats with it', async () => {
    getReferralStatsMock.mockResolvedValue({ total_invoices: 3 });
    renderHook(() => useReferralStats('ABC123'));
    const config = useQueryMock.mock.calls[0][0];
    expect(config.enabled).toBe(true);
    await config.queryFn();
    expect(getReferralStatsMock).toHaveBeenCalledWith('ABC123');
  });
});
