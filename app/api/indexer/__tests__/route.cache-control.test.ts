import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/constants', () => ({
  INDEXER_SERVER_URL: 'https://indexer.internal.example',
  INDEXER_API_KEY: 'sk_cache_control_secret',
}));

import { GET } from '../route';

function call(query: string) {
  return GET(new NextRequest(`http://localhost/api/indexer${query}`));
}

/**
 * Cache-control policy for the legacy `?path=` indexer proxy: every response,
 * success or failure, must be `no-store` because the data feeds financial views.
 */
describe('GET /api/indexer cache-control policy', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends no-store on a successful proxied response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 7, status: 'Funded' }), { status: 200 })
    );

    const res = await call('?path=/invoice/7');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ id: 7, status: 'Funded' });
  });

  it('asks the upstream fetch not to use the Next.js data cache', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 200 }));

    await call('?path=/analytics/defaults');

    const init = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit;
    expect(init.cache).toBe('no-store');
  });

  it('keeps no-store on an upstream error status so a failure is never replayed from cache', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'boom' }), { status: 500 })
    );

    const res = await call('?path=/leaderboard');

    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps no-store when the upstream body is not JSON', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('<html>bad gateway</html>', { status: 502 })
    );

    const res = await call('?path=/leaderboard');

    expect(res.status).toBe(502);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({});
  });

  it('sends no-store when the indexer is unreachable (503)', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('connect ECONNREFUSED'));

    const res = await call('?path=/invoice/7');

    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'Indexer unavailable' });
  });

  it('sends no-store on a missing path (400) without calling the indexer', async () => {
    const res = await call('');

    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends no-store on a path outside the allow-list (403) without calling the indexer', async () => {
    const res = await call('?path=/admin/keys');

    expect(res.status).toBe(403);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
