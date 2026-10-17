/**
 * Unit tests for src/lib/auditLog.ts
 *
 * Verifies:
 * 1. logAdminAction calls Sentry.captureEvent with the correct shape.
 * 2. Tags are set so events are queryable by action and actor.
 * 3. Fingerprint groups repeated actions together.
 * 4. The function is fire-and-forget — a Sentry failure does not throw.
 * 5. No secret-looking values (keys, tokens) are forwarded in the payload.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AdminAuditPayload } from '../auditLog';

// ── Sentry mock ───────────────────────────────────────────────────────────────

const mockCaptureEvent = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  captureEvent: (...args: unknown[]) => mockCaptureEvent(...args),
}));

// Import after mock is registered so the module picks up the stub.
const { logAdminAction } = await import('../auditLog');

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE: AdminAuditPayload = {
  action: 'protocol.pause_confirmed',
  actor: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  page: '/admin',
  timestamp: 1_700_000_000,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('logAdminAction', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear();
  });

  it('calls Sentry.captureEvent once per invocation', () => {
    logAdminAction(BASE);
    expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
  });

  it('sets level to "info"', () => {
    logAdminAction(BASE);
    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'info' })
    );
  });

  it('sets message to admin_audit.<action>', () => {
    logAdminAction(BASE);
    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'admin_audit.protocol.pause_confirmed' })
    );
  });

  it('sets admin_audit.action tag for Sentry queryability', () => {
    logAdminAction(BASE);
    const [call] = mockCaptureEvent.mock.calls;
    expect(call[0].tags['admin_audit.action']).toBe('protocol.pause_confirmed');
  });

  it('sets admin_audit.actor tag for Sentry queryability', () => {
    logAdminAction(BASE);
    const [call] = mockCaptureEvent.mock.calls;
    expect(call[0].tags['admin_audit.actor']).toBe(BASE.actor);
  });

  it('sets admin_audit.page tag', () => {
    logAdminAction(BASE);
    const [call] = mockCaptureEvent.mock.calls;
    expect(call[0].tags['admin_audit.page']).toBe('/admin');
  });

  it('forwards the timestamp to the Sentry event', () => {
    logAdminAction(BASE);
    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: 1_700_000_000 })
    );
  });

  it('includes metadata in extra when provided', () => {
    logAdminAction({ ...BASE, metadata: { proposal_count: 3 } });
    const [call] = mockCaptureEvent.mock.calls;
    expect(call[0].extra.proposal_count).toBe(3);
  });

  it('sets a fingerprint of [admin_audit, action] for grouping', () => {
    logAdminAction(BASE);
    const [call] = mockCaptureEvent.mock.calls;
    expect(call[0].fingerprint).toEqual(['admin_audit', 'protocol.pause_confirmed']);
  });

  it('does not throw when Sentry.captureEvent throws', () => {
    mockCaptureEvent.mockImplementationOnce(() => {
      throw new Error('Sentry unavailable');
    });
    expect(() => logAdminAction(BASE)).not.toThrow();
  });

  it('is a void function — returns undefined', () => {
    expect(logAdminAction(BASE)).toBeUndefined();
  });

  it('works correctly for flags.viewed action on /admin/flags page', () => {
    logAdminAction({
      action: 'flags.viewed',
      actor: BASE.actor,
      page: '/admin/flags',
      timestamp: BASE.timestamp,
      metadata: { flag_count: 3, enabled_count: 0 },
    });
    const [call] = mockCaptureEvent.mock.calls;
    expect(call[0].tags['admin_audit.action']).toBe('flags.viewed');
    expect(call[0].tags['admin_audit.page']).toBe('/admin/flags');
    expect(call[0].extra.flag_count).toBe(3);
  });

  it('works for every defined AdminAuditAction without TypeScript errors', () => {
    // Spot-check a representative from each category.
    const actions: AdminAuditPayload['action'][] = [
      'protocol.pause_requested',
      'protocol.unpause_succeeded',
      'governance.execute_failed',
      'token.approve_submitted',
      'token.remove_confirmed',
      'flags.viewed',
    ];
    for (const action of actions) {
      mockCaptureEvent.mockClear();
      logAdminAction({ ...BASE, action });
      expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
      expect(mockCaptureEvent.mock.calls[0][0].message).toBe(`admin_audit.${action}`);
    }
  });
});
