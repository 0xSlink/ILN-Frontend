import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

/**
 * SQL Schema for status_subscriptions:
 *
 * create table status_subscriptions (
 *   id uuid default gen_random_uuid() primary key,
 *   email text not null,
 *   webhook_url text,
 *   enabled boolean default true,
 *   unsubscribe_token text not null,
 *   created_at timestamptz default now(),
 *   updated_at timestamptz default now()
 * );
 * create unique index idx_status_subscriptions_email on status_subscriptions(email);
 */

// #937 — opt-in email/webhook subscription for status-page incidents.
// Mirrors app/api/reminders/route.ts's shape (validation, rate limiting,
// Supabase upsert) rather than inventing a second convention for "a
// user-supplied contact preference persisted server-side" (see
// docs/notifications-service.md).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;
const POST_RATE_LIMIT_MAX_REQUESTS = 5;
const POST_RATE_LIMIT_WINDOW_MS = 60 * 1000;

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  const rateLimit = checkRateLimit(
    `status-subscriptions-post:${clientKey}`,
    POST_RATE_LIMIT_MAX_REQUESTS,
    POST_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const { email, webhookUrl, enabled } = await req.json();

    if (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (webhookUrl !== undefined && webhookUrl !== null) {
      if (typeof webhookUrl !== 'string' || !isValidWebhookUrl(webhookUrl)) {
        return NextResponse.json({ error: 'Invalid webhook URL (must be https)' }, { status: 400 });
      }
    }
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled flag' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const existing = await supabase
      .from('status_subscriptions')
      .select('unsubscribe_token')
      .eq('email', email)
      .maybeSingle();

    const crypto = await import('crypto');
    const unsubscribeToken = existing.data?.unsubscribe_token ?? crypto.randomBytes(32).toString('hex');

    const { error } = await supabase.from('status_subscriptions').upsert(
      {
        email,
        webhook_url: webhookUrl ?? null,
        enabled: enabled ?? true,
        unsubscribe_token: unsubscribeToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );

    if (error) throw error;

    return NextResponse.json({ success: true, saved: true });
  } catch (error) {
    console.error('Error saving status subscription:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('status_subscriptions')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('email', email);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing status subscription:', error);
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 });
  }
}
