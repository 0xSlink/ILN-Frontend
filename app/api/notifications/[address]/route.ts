import { NextRequest, NextResponse } from 'next/server';
import { StrKey } from '@stellar/stellar-sdk';
import { getNotifications } from '@/lib/notifications';
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
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
