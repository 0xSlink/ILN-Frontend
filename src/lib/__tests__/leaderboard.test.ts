import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLeaderboard } from '../leaderboard';

const fetchMock = vi.fn();

describe('getLeaderboard', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.INDEXER_URL = 'https://indexer.iln.example.com';
  });

  it('fetches and returns the leaderboard JSON (not unavailable)', async () => {
    const rows = [{ address: 'GADDR', amountFunded: 100 }];
    fetchMock.mockResolvedValue({ ok: true, json: async () => rows });

    const result = await getLeaderboard('lp', '30d');
    expect(result).toEqual({ data: rows, unavailable: false });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/leaderboard?type=lp&period=30d'),
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('reports unavailable when the response is not ok (non-404 indexer error)', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const result = await getLeaderboard('lp', '30d');
    expect(result.unavailable).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('reports unavailable when the fetch throws (indexer down)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const result = await getLeaderboard('lp', '30d');
    expect(result.unavailable).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('returns empty (not unavailable) when INDEXER_URL is not configured', async () => {
    delete process.env.INDEXER_URL;
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    const result = await getLeaderboard('lp', '30d');
    expect(result.unavailable).toBe(false);
    expect(result.data).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
