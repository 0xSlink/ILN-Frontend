import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecentProtocolFeed, PROTOCOL_FEED_QUERY_KEY } from '../useRecentProtocolFeed';

const useQueryMock = vi.fn((config: any) => ({ data: undefined, __config: config }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: any) => useQueryMock(config),
}));

const { fetchRecentProtocolContractEventsMock, getAllInvoicesMock, buildProtocolFeedItemsMock } =
  vi.hoisted(() => ({
    fetchRecentProtocolContractEventsMock: vi.fn(),
    getAllInvoicesMock: vi.fn(),
    buildProtocolFeedItemsMock: vi.fn(),
  }));

vi.mock('@/lib/fetch-protocol-contract-events', () => ({
  fetchRecentProtocolContractEvents: fetchRecentProtocolContractEventsMock,
}));
vi.mock('@/utils/soroban', () => ({
  getAllInvoices: getAllInvoicesMock,
}));
vi.mock('@/utils/protocol-feed', () => ({
  buildProtocolFeedItems: buildProtocolFeedItemsMock,
}));

describe('useRecentProtocolFeed', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
    fetchRecentProtocolContractEventsMock.mockReset();
    getAllInvoicesMock.mockReset();
    buildProtocolFeedItemsMock.mockReset();
  });

  it('queries with the protocol feed key and a 60s poll interval', () => {
    renderHook(() => useRecentProtocolFeed());
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toBe(PROTOCOL_FEED_QUERY_KEY);
    expect(config.refetchInterval).toBe(60_000);
    expect(config.staleTime).toBe(55_000);
  });

  it('fetches events and invoices in parallel, indexes invoices by id, and builds feed items', async () => {
    const events = [{ id: 'evt-1' }];
    const invoices = [{ id: 5n }, { id: 9n }];
    fetchRecentProtocolContractEventsMock.mockResolvedValue(events);
    getAllInvoicesMock.mockResolvedValue(invoices);
    buildProtocolFeedItemsMock.mockReturnValue(['feed-item']);

    renderHook(() => useRecentProtocolFeed());
    const config = useQueryMock.mock.calls[0][0];
    const result = await config.queryFn();

    expect(buildProtocolFeedItemsMock).toHaveBeenCalledWith(
      events,
      new Map([
        ['5', invoices[0]],
        ['9', invoices[1]],
      ]),
      10
    );
    expect(result).toEqual(['feed-item']);
  });
});
