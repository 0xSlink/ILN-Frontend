import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../[...path]/route';

const SECRET = 'sk_live_route_secret_42';

function call(path: string) {
  const url = new URL(`http://localhost/api/indexer/${path}`);
  const segments = url.pathname.replace('/api/indexer/', '').split('/');
  return GET(new NextRequest(url), { params: Promise.resolve({ path: segments }) });
}

describe('GET /api/indexer/[...path]', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('INDEXER_URL', 'https://indexer.internal.example');
    vi.stubEnv('INDEXER_API_KEY', SECRET);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('proxies an allow-listed resource as a no-store success envelope', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([{ type: 'funded', timestamp: 1_700_000_000 }]))
      );

    const res = await call('invoices/7/events');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      ok: true,
      resource: 'invoice.events',
      data: [{ type: 'funded', timestamp: 1_700_000_000_000 }],
      meta: { droppedRecords: 0 },
    });
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it('returns a typed error envelope without upstream details on auth failure', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: `bad key ${SECRET}` }), { status: 401 })
      );

    const res = await call('leaderboard?type=lp');
    const text = await res.text();

    expect(res.status).toBe(502);
    expect(JSON.parse(text)).toEqual({
      ok: false,
      error: { code: 'unauthorized', message: expect.any(String) },
    });
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain('indexer.internal.example');
  });

  it('rejects unknown resources with 404', async () => {
    global.fetch = vi.fn();
    const res = await call('admin/keys');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('unknown_resource');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports 503 not_configured when INDEXER_URL is unset', async () => {
    vi.stubEnv('INDEXER_URL', '');
    vi.stubEnv('NEXT_PUBLIC_INDEXER_API_URL', '');
    const res = await call('analytics/defaults');
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('not_configured');
  });
});
