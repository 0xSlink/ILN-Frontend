import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useParameterUpdates, PARAMETER_UPDATE_WINDOW_MS } from '../useParameterUpdates';
import { governanceKeys } from '../keys';

const useQueryMock = vi.fn((config: any) => ({ data: undefined, __config: config }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: any) => useQueryMock(config),
}));

const { fetchParameterUpdatesMock } = vi.hoisted(() => ({ fetchParameterUpdatesMock: vi.fn() }));
vi.mock('@/utils/governance', () => ({
  fetchParameterUpdates: fetchParameterUpdatesMock,
}));

describe('useParameterUpdates', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
  });

  it('queries with the governance parameterUpdates key and fetchParameterUpdates as the fetcher', () => {
    renderHook(() => useParameterUpdates());
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toBe(governanceKeys.parameterUpdates);
    expect(config.queryFn).toBe(fetchParameterUpdatesMock);
  });

  it('filters out events older than the default 48h window', () => {
    renderHook(() => useParameterUpdates());
    const { select } = useQueryMock.mock.calls[0][0];
    const now = Date.now() / 1000;
    const events = [
      { updatedAt: now - 1000, id: 'recent' },
      { updatedAt: now - PARAMETER_UPDATE_WINDOW_MS / 1000 - 1000, id: 'stale' },
    ];
    expect(select(events).map((e: any) => e.id)).toEqual(['recent']);
  });

  it('respects a custom window override', () => {
    const customWindowMs = 60 * 60 * 1000; // 1h
    renderHook(() => useParameterUpdates(customWindowMs));
    const { select } = useQueryMock.mock.calls[0][0];
    const now = Date.now() / 1000;
    const events = [
      { updatedAt: now - 30 * 60, id: 'within-1h' },
      { updatedAt: now - 2 * 60 * 60, id: 'older-than-1h' },
    ];
    expect(select(events).map((e: any) => e.id)).toEqual(['within-1h']);
  });
});
