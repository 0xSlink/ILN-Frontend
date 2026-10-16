import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePayerScores } from '../usePayerScores';
import { reputationKeys } from '../keys';
import type { Invoice } from '@/utils/soroban';

const useQueryMock = vi.fn((config: any) => ({
  data: new Map([
    ['GPAYER1', { score: 90 }],
    ['GPAYER2', { score: 40 }],
  ]),
  isLoading: false,
  __config: config,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: any) => useQueryMock(config),
}));

describe('usePayerScores', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
  });

  it('derives unique sorted payers and queries with payerScoresBatch key', () => {
    const mockInvoices: Partial<Invoice>[] = [
      { payer: 'GPAYER2' },
      { payer: 'GPAYER1' },
      { payer: 'GPAYER1' },
    ];

    const { result } = renderHook(() => usePayerScores(mockInvoices as Invoice[]));

    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual(reputationKeys.payerScoresBatch(['GPAYER1', 'GPAYER2']));
    expect(config.enabled).toBe(true);

    expect(result.current.scores.size).toBe(2);
    expect(result.current.risks.get('GPAYER1')).toBeDefined();
    expect(result.current.risks.get('GPAYER2')).toBeDefined();
  });

  it('disables query when invoice list is empty', () => {
    renderHook(() => usePayerScores([]));
    const config = useQueryMock.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});
