import { NextRequest, NextResponse } from 'next/server';
import { INDEXER_SERVER_URL, INDEXER_API_KEY } from '@/constants';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Cache-control policy for the indexer proxy.
 *
 * Every response from this route (success, upstream error, validation error,
 * allow-list rejection and proxy failure) carries `Cache-Control: no-store`.
 * Indexer data feeds financial views (invoice status, balances, analytics), so a
 * browser, CDN or intermediary must never serve a stale copy or replay an old
 * error. The upstream fetch is also issued with `cache: 'no-store'` so Next.js'
 * data cache never holds an indexer response between requests. Freshness is
 * handled by the client re-requesting, not by revalidation headers.
 */
// Not exported: Next.js route modules may only export route handlers and route config.
const INDEXER_CACHE_HEADERS = { 'Cache-Control': 'no-store' } as const;

/** Paths the server-owned indexer proxy is allowed to forward. */
const ALLOWED_PREFIXES = ['/invoice/', '/analytics/', '/v1/analytics/', '/leaderboard'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');
  if (!path) {
    return NextResponse.json(
      { error: 'Missing path' },
      { status: 400, headers: INDEXER_CACHE_HEADERS }
    );
  }

  if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return NextResponse.json(
      { error: 'Not allowed' },
      { status: 403, headers: INDEXER_CACHE_HEADERS }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${INDEXER_SERVER_URL}${path}`, {
      signal: controller.signal,
      headers: INDEXER_API_KEY ? { 'X-API-Key': INDEXER_API_KEY } : {},
      cache: 'no-store',
    });

    const body = (await res.json().catch(() => null)) ?? {};
    return NextResponse.json(body, {
      status: res.status,
      headers: INDEXER_CACHE_HEADERS,
    });
  } catch {
    return NextResponse.json(
      { error: 'Indexer unavailable' },
      { status: 503, headers: INDEXER_CACHE_HEADERS }
    );
  } finally {
    clearTimeout(timeout);
  }
}
