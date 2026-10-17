import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { routeAlert } from '@/lib/alert-routing';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

/**
 * Instatus incoming webhook (#937 delivery + #936 alert-routing fan-out).
 *
 * Configured as a webhook subscriber on the Instatus page (admin panel ->
 * Subscribers -> Webhook), pointed at this route. Instatus calls it on
 * incident create/update; this handler:
 *  1. Emails every enabled status_subscriptions row (reusing Resend, the
 *     same delivery mechanism app/api/reminders/route.ts already uses —
 *     see docs/notifications-service.md for why this repo doesn't stand up
 *     a second email pipeline).
 *  2. POSTs matching subscriber webhook URLs.
 *  3. Forwards the event into the shared alert-routing path (#936).
 *
 * Verified via a shared-secret header rather than a signature scheme
 * because Instatus's webhook product does not document HMAC signing at the
 * time of writing — see docs/alert-routing-integration.md's residual-risk
 * section.
 */

const WEBHOOK_RATE_LIMIT_MAX = 60;
const WEBHOOK_RATE_LIMIT_WINDOW_MS = 60 * 1000;

interface InstatusWebhookPayload {
  page: { id: string; name: string };
  incident?: {
    id: string;
    name: string;
    status: string; // INVESTIGATING | IDENTIFIED | MONITORING | RESOLVED
    url: string;
  };
  component?: { id: string; name: string; status: string };
}

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  const rateLimit = checkRateLimit(
    `status-webhook:${clientKey}`,
    WEBHOOK_RATE_LIMIT_MAX,
    WEBHOOK_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const secret = req.headers.get('x-status-webhook-secret');
  if (!process.env.STATUS_WEBHOOK_SECRET || secret !== process.env.STATUS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: InstatusWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const incident = payload.incident;
  if (!incident) {
    // Component-only status changes (no incident) still get routed for alerting.
    if (payload.component) {
      await routeAlert({
        component: 'web-app',
        status: payload.component.status === 'OPERATIONAL' ? 'operational' : 'degraded',
        severity: 'warning',
        summary: `Component ${payload.component.name} is now ${payload.component.status}`,
        source: 'frontend-instatus-webhook',
        detail: { componentId: payload.component.id },
      });
    }
    return NextResponse.json({ received: true });
  }

  const isResolved = incident.status === 'RESOLVED';

  // #936 — forward into the shared alert-routing path regardless of
  // delivery outcome below; alerting and subscriber notification are
  // independent concerns and one failing must not block the other.
  await routeAlert({
    component: 'web-app',
    status: isResolved ? 'operational' : 'degraded',
    severity: isResolved ? 'info' : 'critical',
    summary: `${incident.name} — ${incident.status}`,
    source: 'frontend-instatus-webhook',
    detail: { incidentId: incident.id, incidentUrl: incident.url },
  });

  // #937 — fan out to opted-in subscribers on open and resolve.
  try {
    const supabase = getSupabaseAdmin();
    const { data: subscribers, error } = await supabase
      .from('status_subscriptions')
      .select('email, webhook_url')
      .eq('enabled', true);

    if (error) throw error;

    const results = { emailed: 0, webhooked: 0, failed: 0 };

    for (const sub of subscribers ?? []) {
      try {
        await getResend().emails.send({
          from: 'ILN Status <status@iln.finance>',
          to: [sub.email],
          subject: `[${isResolved ? 'Resolved' : 'Incident'}] ${incident.name}`,
          text: `${incident.name}\n\nStatus: ${incident.status}\n\nDetails: ${incident.url}`,
        });
        results.emailed += 1;
      } catch (err) {
        console.error('Error emailing status subscriber:', err);
        results.failed += 1;
      }

      if (sub.webhook_url) {
        try {
          await fetch(sub.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              incidentId: incident.id,
              name: incident.name,
              status: incident.status,
              url: incident.url,
            }),
          });
          results.webhooked += 1;
        } catch (err) {
          console.error('Error posting to subscriber webhook:', err);
          results.failed += 1;
        }
      }
    }

    return NextResponse.json({ received: true, ...results });
  } catch (error) {
    console.error('Error fanning out status webhook to subscribers:', error);
    // Still 200 — Instatus doesn't need to retry just because our fan-out
    // to subscribers failed; the underlying incident record is unaffected.
    return NextResponse.json({ received: true, fanOutFailed: true });
  }
}
