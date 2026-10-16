import { NextRequest, NextResponse } from 'next/server';
import { StrKey } from '@stellar/stellar-sdk';
import { getNotifications, NotificationsServiceError } from '@/lib/notifications';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;

  if (typeof address !== 'string' || !StrKey.isValidEd25519PublicKey(address.trim())) {
    return NextResponse.json({ error: 'Invalid Stellar address' }, { status: 400 });
  }

  const clientKey = getClientKey(_req);
  const rateLimit = checkRateLimit(
    `notifications:${clientKey}`,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const data = await getNotifications(address.trim());
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof NotificationsServiceError) {
      const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
      if (error.retryAfterSeconds !== undefined) {
        headers['Retry-After'] = String(error.retryAfterSeconds);
      }
      // Surface the service's failure mode to the client so it can distinguish
      // "delivery temporarily degraded" from a generic error. Clients silently
      // skipping non-2xx responses will fall back to previously cached
      // notifications rather than a broken/blank state.
      if (error.kind === 'rate-limited') {
        return NextResponse.json(
          { error: 'Notifications service is rate limiting requests', kind: error.kind },
          { status: 429, headers }
        );
      }
      return NextResponse.json(
        { error: 'Notifications service temporarily unavailable', kind: error.kind },
        { status: 503, headers }
      );
    }
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
