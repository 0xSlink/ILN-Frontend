import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { StrKey } from '@stellar/stellar-sdk';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import crypto from 'crypto';

const UNSUBSCRIBE_RATE_LIMIT_MAX_REQUESTS = 10;
const UNSUBSCRIBE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

async function verifyUnsubscribeToken(address: string, token: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('reminder_preferences')
      .select('unsubscribe_token')
      .eq('address', address)
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    if (!data.unsubscribe_token) {
      return false;
    }

    const validToken = crypto
      .createHash('sha256')
      .update(data.unsubscribe_token + process.env.UNSUBSCRIBE_TOKEN_SECRET || 'default-secret')
      .digest('hex');

    return token === validToken;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  const clientKey = getClientKey(req);
  const rateLimit = checkRateLimit(
    `unsubscribe:${clientKey}`,
    UNSUBSCRIBE_RATE_LIMIT_MAX_REQUESTS,
    UNSUBSCRIBE_RATE_LIMIT_WINDOW_MS
  );

  if (!rateLimit.allowed) {
    return new NextResponse(
      '<html><body><h1>Error</h1><p>Too many requests. Please try again later.</p></body></html>',
      {
        status: 429,
        headers: {
          'Content-Type': 'text/html',
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const token = searchParams.get('token');

  if (!address || !token) {
    return new NextResponse(
      '<html><body><h1>Error</h1><p>Invalid unsubscribe link.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (!StrKey.isValidEd25519PublicKey(address.trim())) {
    return new NextResponse(
      '<html><body><h1>Error</h1><p>Invalid unsubscribe link.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    const isValid = await verifyUnsubscribeToken(address, token);

    if (!isValid) {
      console.warn(`Invalid unsubscribe token attempt for address: ${address}`);
    }

    if (isValid) {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from('reminder_preferences')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('address', address);

      if (error) throw error;
    }

    return new NextResponse(
      '<html><body><h1>Unsubscribed</h1><p>You have been successfully unsubscribed from payment reminders.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return new NextResponse(
      '<html><body><h1>Unsubscribed</h1><p>You have been successfully unsubscribed from payment reminders.</p></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
