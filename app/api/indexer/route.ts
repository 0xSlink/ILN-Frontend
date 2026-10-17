import { NextRequest, NextResponse } from 'next/server';
import { INDEXER_SERVER_URL, INDEXER_API_KEY } from '@/constants';

const REQUEST_TIMEOUT_MS = 15_000;

/** Paths the server-owned indexer proxy is allowed to forward. */
const ALLOWED_PREFIXES = ['/invoice/', '/analytics/', '/v1/analytics/', '/leaderboard'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');
  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
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
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Indexer unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  } finally {
    clearTimeout(timeout);
  }
}
