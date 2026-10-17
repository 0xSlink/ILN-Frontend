/**
 * Shared alert-routing client (#936).
 *
 * The backend repo's hardening batch built shared alert-routing
 * infrastructure for its own monitoring (see docs/alert-routing-integration.md
 * for what's coordinated and what's still an assumption pending that repo's
 * schema). This module is the frontend-side equivalent: a single place that
 * knows how to post a component-health event to that shared path, so the
 * synthetic canary (#938) and the Instatus incident webhook (#937) don't each
 * need their own notion of "how do I reach the alert router."
 *
 * Fails open by design, same rationale as lib/notifications.ts's
 * getNotificationsServiceStatus: alert-routing delivery going down must never
 * become a reason a canary run or an incident webhook itself fails.
 */

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertRoutingEvent {
  /** Matches the status-page component naming in docs/status-page-runbook.md. */
  component: 'web-app' | 'api-indexer' | 'stellar-rpc' | 'smart-contracts';
  status: 'operational' | 'degraded' | 'down';
  severity: AlertSeverity;
  summary: string;
  /** Free-form context: canary run id, Instatus incident id, affected route, etc. */
  detail?: Record<string, unknown>;
  source: 'frontend-synthetic-canary' | 'frontend-instatus-webhook';
  timestamp: string;
}

export interface AlertRoutingResult {
  routed: boolean;
  error?: string;
}

/**
 * POSTs one alert event to the shared alert-routing webhook. Returns
 * `{ routed: false, error }` instead of throwing on any failure (missing
 * config, network error, non-2xx) — callers log/report the outcome but must
 * never let a routing failure block the underlying canary/incident flow.
 */
export async function routeAlert(
  event: Omit<AlertRoutingEvent, 'timestamp'>
): Promise<AlertRoutingResult> {
  const webhookUrl = process.env.ALERT_ROUTING_WEBHOOK_URL;
  if (!webhookUrl) {
    return { routed: false, error: 'ALERT_ROUTING_WEBHOOK_URL not configured' };
  }

  const payload: AlertRoutingEvent = { ...event, timestamp: new Date().toISOString() };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ALERT_ROUTING_SECRET
          ? { Authorization: `Bearer ${process.env.ALERT_ROUTING_SECRET}` }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return { routed: false, error: `alert-routing responded ${res.status}` };
    }
    return { routed: true };
  } catch (err) {
    return { routed: false, error: err instanceof Error ? err.message : 'unknown error' };
  }
}
