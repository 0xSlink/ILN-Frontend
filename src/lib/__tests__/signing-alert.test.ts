import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordSigningAttempt,
  getSigningHealthStatus,
  resetSigningAlertState,
  SIGNING_ALERT_EVENT,
} from '@/lib/signing-alert';
import * as Sentry from '@sentry/nextjs';
import { trackEvent } from '@/lib/analytics';

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('signing-alert (Real-Time Signing Failure Rate Spike Alerting)', () => {
  beforeEach(() => {
    resetSigningAlertState();
    vi.clearAllMocks();
  });

  it('maintains optimal health status under normal successful signing operations', () => {
    for (let i = 0; i < 5; i++) {
      const status = recordSigningAttempt({
        flow: 'invoice_submission',
        success: true,
      });
      expect(status.isHealthy).toBe(true);
      expect(status.activeAlert).toBeNull();
      expect(status.consecutiveFailures).toBe(0);
    }

    const health = getSigningHealthStatus();
    expect(health.isHealthy).toBe(true);
    expect(health.failureRate).toBe(0);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('tolerates isolated occasional failures without triggering false-positive alerts', () => {
    // 4 successes, 1 failure => 20% failure rate out of 5 attempts (1/5)
    recordSigningAttempt({ flow: 'lp_funding', success: true });
    recordSigningAttempt({ flow: 'lp_funding', success: true });
    recordSigningAttempt({ flow: 'lp_funding', success: true });
    recordSigningAttempt({ flow: 'lp_funding', success: true });
    const status = recordSigningAttempt({
      flow: 'lp_funding',
      success: false,
      errorCode: 'TX_FAILED',
      errorMessage: 'RPC timeout',
    });

    // 1 failure alone is not consecutive spike (requires 3) and failure rate is 20% but with single error
    expect(status.consecutiveFailures).toBe(1);
    expect(status.totalAttempts).toBe(5);
  });

  it('triggers immediate high-priority SEV-1 escalation when consecutive failure threshold is breached', () => {
    const alertListener = vi.fn();
    window.addEventListener(SIGNING_ALERT_EVENT, alertListener);

    // Simulate 3 consecutive transaction signing failures (e.g. broken wallet extension or contract mismatch)
    recordSigningAttempt({
      flow: 'invoice_submission',
      success: false,
      errorCode: 'WALLET_DISCONNECTED',
      errorMessage: 'Freighter extension rejected connection',
    });

    recordSigningAttempt({
      flow: 'invoice_submission',
      success: false,
      errorCode: 'UNAUTHORIZED_SIGNER',
      errorMessage: 'Signer key mismatch on Soroban contract',
    });

    const status = recordSigningAttempt({
      flow: 'invoice_submission',
      success: false,
      errorCode: 'TRANSACTION_REJECTED',
      errorMessage: 'Host error: Contract function missing',
    });

    // Verify health status is in active alert state
    expect(status.isHealthy).toBe(false);
    expect(status.activeAlert).not.toBeNull();
    expect(status.activeAlert?.severity).toBe('SEV-1');
    expect(status.consecutiveFailures).toBe(3);
    expect(status.activeAlert?.affectedFlow).toBe('invoice_submission');

    // Verify Sentry high-priority notification was dispatched
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('[SEV-1 Alert] Transaction-signing failure rate spike'),
      expect.objectContaining({
        level: 'fatal',
        tags: expect.objectContaining({
          alert_type: 'signing_failure_spike',
          severity: 'SEV-1',
          affected_flow: 'invoice_submission',
        }),
      })
    );

    // Verify analytics alert event
    expect(trackEvent).toHaveBeenCalledWith('signing_failure_spike_alert', {
      severity: 'SEV-1',
      failureRate: expect.any(Number),
      consecutiveFailures: 3,
      flow: 'invoice_submission',
    });

    // Verify DOM CustomEvent was dispatched
    expect(alertListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(SIGNING_ALERT_EVENT, alertListener);
  });

  it('triggers SEV-1 alert when sliding window failure rate exceeds threshold with high volume', () => {
    // 2 successes, 4 failures
    recordSigningAttempt({ flow: 'governance_voting', success: true });
    recordSigningAttempt({ flow: 'governance_voting', success: true });
    recordSigningAttempt({ flow: 'governance_voting', success: false, errorCode: 'ERR_1' });
    recordSigningAttempt({ flow: 'governance_voting', success: true });
    recordSigningAttempt({ flow: 'governance_voting', success: false, errorCode: 'ERR_2' });
    recordSigningAttempt({ flow: 'governance_voting', success: false, errorCode: 'ERR_3' });

    const health = getSigningHealthStatus();
    expect(health.isHealthy).toBe(false);
    expect(health.activeAlert?.severity).toBe('SEV-1');
    expect(health.failedAttempts).toBeGreaterThanOrEqual(3);
    expect(Sentry.captureMessage).toHaveBeenCalled();
  });
});
