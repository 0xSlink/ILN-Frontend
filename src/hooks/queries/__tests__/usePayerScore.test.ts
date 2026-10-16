import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePayerScore } from '../usePayerScore';
import { reputationKeys } from '../keys';

const useQueryMock = vi.fn((config: any) => ({ data: undefined, __config: config }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: any) => useQueryMock(config),
}));

const getPayerScoreMock = vi.fn();
vi.mock('@/utils/soroban', () => ({
  getPayerScore: (...args: unknown[]) => getPayerScoreMock(...args),
}));

describe('usePayerScore', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
    getPayerScoreMock.mockClear();
  });

  it('queries with the payerScore key and enables query when address is provided', () => {
    const address = 'GPAYER123';
    renderHook(() => usePayerScore(address));
    const config = useQueryMock.mock.calls[0][0];

    expect(config.queryKey).toEqual(reputationKeys.payerScore(address));
    expect(config.enabled).toBe(true);
  });

  it('disables query when address is undefined', () => {
    renderHook(() => usePayerScore(undefined));
    const config = useQueryMock.mock.calls[0][0];

    expect(config.enabled).toBe(false);
  });

  it('executes getPayerScore with address in queryFn', async () => {
    getPayerScoreMock.mockResolvedValue({ score: 85, level: 'Low' });
    renderHook(() => usePayerScore('GPAYER123'));
    const config = useQueryMock.mock.calls[0][0];

    const result = await config.queryFn();
    expect(getPayerScoreMock).toHaveBeenCalledWith('GPAYER123');
    expect(result).toEqual({ score: 85, level: 'Low' });
  });
});
