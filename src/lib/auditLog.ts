'use client';

/**
 * Admin audit logging.
 *
 * Every privileged action on /admin and /admin/flags is emitted as a Sentry
 * event with level "info" and a consistent tag set so incidents can be
 * investigated by querying `admin_audit.*` in Sentry's issue search or the
 * Discover query builder.
 *
 * Design constraints:
 * - Client-only: all admin pages are 'use client' components; Sentry is
 *   already initialised client-side via sentry.client.config.ts.
 * - Fire-and-forget: audit logging must never block or throw into the UI.
 *   Errors are silently swallowed after a console.warn.
 * - No secrets: the actor field is the wallet address (public on-chain
 *   identity), never a private key or token.
 * - Queryable: every event has `admin_audit.action` and `admin_audit.actor`
 *   tags so Sentry Discover can filter to a specific admin session or action.
 *
 * See docs/sentry-integration.md for the monitoring stack overview.
 */

import * as Sentry from '@sentry/nextjs';

/** All recognised admin action identifiers. */
export type AdminAuditAction =
  // /admin (protocol health dashboard)
  | 'protocol.pause_requested'
  | 'protocol.pause_confirmed'
  | 'protocol.pause_succeeded'
  | 'protocol.pause_failed'
  | 'protocol.unpause_requested'
  | 'protocol.unpause_confirmed'
  | 'protocol.unpause_succeeded'
  | 'protocol.unpause_failed'
  | 'governance.execute_requested'
  | 'governance.execute_confirmed'
  | 'governance.execute_succeeded'
  | 'governance.execute_failed'
  | 'token.approve_submitted'
  | 'token.approve_succeeded'
  | 'token.approve_failed'
  | 'token.remove_requested'
  | 'token.remove_confirmed'
  | 'token.remove_succeeded'
  | 'token.remove_failed'
  // /admin/flags (feature flag dashboard)
  | 'flags.viewed';

export interface AdminAuditPayload {
  /** Structured action identifier, used as Sentry tag for querying. */
  action: AdminAuditAction;
  /**
   * Wallet address of the acting admin (public on-chain identity).
   * Never include private keys, tokens, or secrets here.
   */
  actor: string;
  /** Source page for correlation. */
  page: '/admin' | '/admin/flags';
  /** Unix timestamp (seconds). */
  timestamp: number;
  /** Optional free-form metadata. Values must not include secrets. */
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Emit a structured audit event to Sentry.
 *
 * Always fire-and-forget — never await and never let it throw into calling code.
 */
export function logAdminAction(payload: AdminAuditPayload): void {
  try {
    Sentry.captureEvent({
      message: `admin_audit.${payload.action}`,
      level: 'info',
      timestamp: payload.timestamp,
      tags: {
        'admin_audit.action': payload.action,
        'admin_audit.actor': payload.actor,
        'admin_audit.page': payload.page,
      },
      extra: {
        actor: payload.actor,
        page: payload.page,
        timestamp: payload.timestamp,
        ...(payload.metadata ?? {}),
      },
      // Fingerprint by action so repeated identical events group together in
      // Sentry rather than being treated as separate issues. This keeps the
      // audit trail clean and avoids alert fatigue.
      fingerprint: ['admin_audit', payload.action],
    });
  } catch (err) {
    // Audit logging must never crash the UI.
    console.warn('[auditLog] Failed to emit audit event:', err);
  }
}
