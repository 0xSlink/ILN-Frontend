import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReputation } from '../useReputation';
import { reputationKeys } from '../keys';

const useQueryMock = vi.fn((config: any) => ({ data: undefined, __config: config }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: any) => useQueryMock(config),
}));

const getReputationMock = vi.fn();
vi.mock('@/utils/soroban', () => ({
  getReputation: (...args: unknown[]) => getReputationMock(...args),
}));

describe('useReputation', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
    getReputationMock.mockClear();
  });

  it('queries with the reputation detail key and enables query when address is provided', () => {
    const address = 'G1234567890';
    renderHook(() => useReputation(address));
    const config = useQueryMock.mock.calls[0][0];

    expect(config.queryKey).toEqual(reputationKeys.detail(address));
    expect(config.enabled).toBe(true);
  });

  it('disables query when address is undefined or empty', () => {
    renderHook(() => useReputation(undefined));
    const config = useQueryMock.mock.calls[0][0];

    expect(config.enabled).toBe(false);
  });

  it('executes getReputation with address in queryFn', async () => {
    getReputationMock.mockResolvedValue({ score: 95 });
    renderHook(() => useReputation('G123'));
    const config = useQueryMock.mock.calls[0][0];

    const result = await config.queryFn();
    expect(getReputationMock).toHaveBeenCalledWith('G123');
    expect(result).toEqual({ score: 95 });
  });
});
