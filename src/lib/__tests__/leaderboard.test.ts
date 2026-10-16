import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLeaderboard } from '../leaderboard';
import { IndexerError } from '../indexer/errors';

const originalFetch = global.fetch;

beforeEach(() => {
  vi.stubEnv('INDEXER_URL', 'https://indexer.internal.example');
  vi.stubEnv('INDEXER_API_KEY', 'sk_leaderboard_test');
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe('getLeaderboard', () => {
  it('reads through the server-only indexer client with validation', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ address: 'GAAA', metric1: 2 }, { metric1: 1 }]), {
        headers: { 'X-Indexer-Api-Version': '1.0.0' },
      })
    );

    await expect(getLeaderboard('payer', '90d', 5)).resolves.toEqual([
      { address: 'GAAA', metric1: 2 },
    ]);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://indexer.internal.example/leaderboard?type=payer&period=90d&limit=5');
    expect(init.headers.Authorization).toBe('Bearer sk_leaderboard_test');
  });

  it('throws typed errors instead of returning an empty leaderboard', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    await expect(getLeaderboard('lp', 'all')).rejects.toBeInstanceOf(IndexerError);
    await expect(getLeaderboard('lp', 'all')).rejects.toMatchObject({ code: 'unauthorized' });
  });
});
