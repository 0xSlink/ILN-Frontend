import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchRecentProtocolContractEvents,
  fetchProtocolContractEvents,
} from '../fetch-protocol-contract-events';

const dedupedFetchMock = vi.fn((_key: string, fn: () => Promise<unknown>) => fn());
vi.mock('@/lib/horizonClient', () => ({
  dedupedFetch: (...args: [string, () => Promise<unknown>, number]) => dedupedFetchMock(...args),
  TTL: { EVENTS: 60_000 },
}));

vi.mock('@/lib/horizon', () => ({
  getHorizonBaseUrl: () => 'https://horizon-testnet.stellar.org',
}));

const parseContractEventsFromTransactionMock = vi.fn();
vi.mock('@/lib/contract-events', () => ({
  parseContractEventsFromTransaction: (...args: unknown[]) =>
    parseContractEventsFromTransactionMock(...args),
}));

const fetchMock = vi.fn();

describe('fetchRecentProtocolContractEvents', () => {
  beforeEach(() => {
    dedupedFetchMock.mockClear();
    parseContractEventsFromTransactionMock.mockReset();
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('fetches one page and returns events sorted newest first', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [{ hash: 'tx1' }, { hash: 'tx2' }],
        },
      }),
    });
    parseContractEventsFromTransactionMock
      .mockReturnValueOnce([{ createdAt: '2026-01-01T00:00:00Z' }])
      .mockReturnValueOnce([{ createdAt: '2026-01-03T00:00:00Z' }]);

    const events = await fetchRecentProtocolContractEvents();
    expect(events.map((e: any) => e.createdAt)).toEqual([
      '2026-01-03T00:00:00Z',
      '2026-01-01T00:00:00Z',
    ]);
  });

  it('treats a missing createdAt as epoch 0 when sorting', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ _embedded: { records: [{ hash: 'tx1' }] } }),
    });
    parseContractEventsFromTransactionMock.mockReturnValue([{}]);
    const events = await fetchRecentProtocolContractEvents();
    expect(events).toHaveLength(1);
  });

  it('throws when the Horizon request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchRecentProtocolContractEvents()).rejects.toThrow(
      'Horizon transaction fetch failed: 503'
    );
  });
});

describe('fetchProtocolContractEvents', () => {
  beforeEach(() => {
    dedupedFetchMock.mockClear();
    parseContractEventsFromTransactionMock.mockReset();
    parseContractEventsFromTransactionMock.mockReturnValue([{ id: 'evt' }]);
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('stops paginating once a record older than the cutoff is reached', async () => {
    const now = Date.now();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            { hash: 'recent', created_at: new Date(now).toISOString() },
            { hash: 'old', created_at: new Date(now - 200 * 86_400_000).toISOString() },
          ],
        },
        _links: { next: { href: 'https://horizon-testnet.stellar.org/next' } },
      }),
    });

    const events = await fetchProtocolContractEvents(90);
    expect(events).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows pagination links across multiple pages', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          _embedded: { records: [{ hash: 'tx1', created_at: new Date().toISOString() }] },
          _links: { next: { href: 'https://horizon-testnet.stellar.org/page2' } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          _embedded: { records: [{ hash: 'tx2', created_at: new Date().toISOString() }] },
        }),
      });

    const events = await fetchProtocolContractEvents(90);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(2);
  });

  it('stops when a page has no records', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ _embedded: { records: [] } }) });
    const events = await fetchProtocolContractEvents(90);
    expect(events).toEqual([]);
  });

  it('stops when there is no next page link', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: { records: [{ hash: 'tx1', created_at: new Date().toISOString() }] },
      }),
    });
    const events = await fetchProtocolContractEvents(90);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
  });

  it('includes records with an unparseable created_at without treating them as the cutoff', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: { records: [{ hash: 'tx1', created_at: 'not-a-date' }] },
      }),
    });
    const events = await fetchProtocolContractEvents(90);
    expect(events).toHaveLength(1);
  });
});
