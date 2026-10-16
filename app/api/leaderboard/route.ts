import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/leaderboard';
import { IndexerError } from '@/lib/indexer/errors';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

const ALLOWED_TYPES = ['lp', 'payer', 'freelancer'];
const ALLOWED_PERIODS = ['7d', '30d', '90d', 'all'];
const MAX_LIMIT = 100;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(req: NextRequest) {
  const clientKey = getClientKey(req);
  const rateLimit = checkRateLimit(
    `leaderboard:${clientKey}`,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(req.url);

  const type = searchParams.get('type') || 'lp';
  const period = searchParams.get('period') || 'all';
  const limitParam = searchParams.get('limit');

  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid leaderboard type' }, { status: 400 });
  }

  if (!ALLOWED_PERIODS.includes(period)) {
    return NextResponse.json({ error: 'Invalid leaderboard period' }, { status: 400 });
  }

  let limit: number | undefined;
  if (limitParam !== null) {
    limit = Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
    }
  }

  try {
    const data = await getLeaderboard(type, period, limit);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // Typed indexer failures keep their code/status; never echo upstream details.
    if (error instanceof IndexerError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    console.error('Error fetching leaderboard:', (error as Error)?.name ?? 'Error');
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
