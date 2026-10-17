import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { StrKey } from '@stellar/stellar-sdk';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getNotificationsServiceStatus } from '@/lib/notifications';
import PaymentReminderEmail from '@/emails/PaymentReminder';
import { getAllInvoices, getTokenMetadata } from '@/utils/soroban';
import { formatTokenAmount } from '@/utils/format';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;
const POST_RATE_LIMIT_MAX_REQUESTS = 5;
const POST_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const GET_RATE_LIMIT_MAX_REQUESTS = 10;
const GET_RATE_LIMIT_WINDOW_MS = 60 * 1000;

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// POST: Save/Update opt-in preference
export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  const rateLimit = checkRateLimit(
    `reminders-post:${clientKey}`,
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
    const { address, email, enabled } = await req.json();

    if (!address || !email) {
      return NextResponse.json({ error: 'Address and email are required' }, { status: 400 });
    }

    if (typeof address !== 'string' || !StrKey.isValidEd25519PublicKey(address.trim())) {
      return NextResponse.json({ error: 'Invalid Stellar address' }, { status: 400 });
    }

    if (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled flag' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('reminder_preferences').upsert(
      {
        address: address.trim(),
        email,
        enabled: enabled ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'address' }
    );

    if (error) throw error;

    // The preference is persisted regardless of delivery health (a "saved but
    // delivery temporarily degraded" state). Distinguish that from a failed
    // save so the client can show the right guidance. See
    // docs/notifications-service.md.
    const delivery = await getNotificationsServiceStatus();

    const response: {
      success: true;
      saved: true;
      delivery: 'ok' | 'degraded';
      retryAfterSeconds?: number;
    } = {
      success: true,
      saved: true,
      delivery: delivery.status === 'ok' ? 'ok' : 'degraded',
    };
    if (delivery.status !== 'ok' && delivery.retryAfterSeconds !== undefined) {
      response.retryAfterSeconds = delivery.retryAfterSeconds;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error saving reminder preference:', error);
    return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 });
  }
}

// GET: Trigger reminders (intended for cron job)
export async function GET(req: NextRequest) {
  // Simple auth check via secret header
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientKey = getClientKey(req);
  const rateLimit = checkRateLimit(
    `reminders-get:${clientKey}`,
    GET_RATE_LIMIT_MAX_REQUESTS,
    GET_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1. Fetch active preferences
    const { data: preferences, error: prefError } = await supabase
      .from('reminder_preferences')
      .select('*')
      .eq('enabled', true);

    if (prefError) throw prefError;
    if (!preferences || preferences.length === 0) {
      return NextResponse.json({ message: 'No active preferences' });
    }

    // 2. Fetch all invoices from contract
    const allInvoices = await getAllInvoices();
    const now = Math.floor(Date.now() / 1000);
    const sentResults = [];

    for (const pref of preferences) {
      // Filter for outstanding invoices addressed to this payer
      const payerInvoices = allInvoices.filter(
        (inv) => inv.payer === pref.address && inv.status === 'Funded'
      );

      for (const inv of payerInvoices) {
        const dueDate = Number(inv.due_date);
        const secondsUntilDue = dueDate - now;
        const hoursUntilDue = secondsUntilDue / 3600;

        let milestone: 24 | 72 | null = null;
        if (hoursUntilDue > 0 && hoursUntilDue <= 24) {
          milestone = 24;
        } else if (hoursUntilDue > 48 && hoursUntilDue <= 72) {
          milestone = 72;
        }

        if (milestone) {
          // Check if already sent for this invoice and milestone
          const { data: alreadySent } = await supabase
            .from('sent_reminders')
            .select('id')
            .eq('invoice_id', inv.id.toString())
            .eq('milestone', milestone)
            .maybeSingle();

          if (!alreadySent) {
            const token = await getTokenMetadata(inv.token || '');
            const formattedAmount = formatTokenAmount(inv.amount, token);
            const formattedDate = new Date(dueDate * 1000).toLocaleDateString();

            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.iln.finance';
            const payerLink = `${baseUrl}/payer`;
            const payNowLink = `${baseUrl}/pay/${inv.id.toString()}`;

            const supabase = getSupabaseAdmin();
            const { data: prefData } = await supabase
              .from('reminder_preferences')
              .select('unsubscribe_token')
              .eq('address', pref.address)
              .maybeSingle();

            let unsubscribeToken = prefData?.unsubscribe_token;
            if (!unsubscribeToken) {
              const crypto = await import('crypto');
              unsubscribeToken = crypto.randomBytes(32).toString('hex');
              await supabase
                .from('reminder_preferences')
                .update({ unsubscribe_token: unsubscribeToken })
                .eq('address', pref.address);
            }

            const tokenHash = require('crypto')
              .createHash('sha256')
              .update(unsubscribeToken + (process.env.UNSUBSCRIBE_TOKEN_SECRET || 'default-secret'))
              .digest('hex');

            const unsubscribeUrl = `${baseUrl}/api/reminders/unsubscribe?address=${pref.address}&token=${tokenHash}`;

            const { error: sendError } = await getResend().emails.send({
              from: 'ILN Reminders <reminders@iln.finance>',
              to: [pref.email],
              subject: `Payment Reminder: Invoice #${inv.id} is due in ${milestone} hours`,
              react: PaymentReminderEmail({
                invoiceId: inv.id.toString(),
                amount: formattedAmount,
                token: token.symbol,
                dueDate: formattedDate,
                payerLink,
                payNowLink,
              }),
              headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
              },
            });

            if (sendError) {
              console.error(`Resend error for invoice ${inv.id}:`, sendError);
            } else {
              // Mark as sent in DB
              await supabase.from('sent_reminders').insert({
                invoice_id: inv.id.toString(),
                milestone,
                sent_at: new Date().toISOString(),
                email: pref.email,
              });
              sentResults.push({ invoiceId: inv.id.toString(), milestone, email: pref.email });
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      sentCount: sentResults.length,
      details: sentResults,
    });
  } catch (error) {
    console.error('Error sending reminders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
