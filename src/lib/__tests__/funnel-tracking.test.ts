import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trackFunnelStep,
  getFunnelAnalyticsReport,
  resetSessionFunnelTracking,
} from '@/lib/funnel-tracking';
import { trackEvent } from '@/lib/analytics';

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('funnel-tracking', () => {
  beforeEach(() => {
    resetSessionFunnelTracking();
    vi.clearAllMocks();
  });

  it('tracks funnel stages and dispatches analytics events', () => {
    trackFunnelStep('invoice_submission', 'started', { token: 'USDC' });
    trackFunnelStep('invoice_submission', 'details_entered', { token: 'USDC' });
    trackFunnelStep('invoice_submission', 'preview_viewed', { token: 'USDC' });
    trackFunnelStep('invoice_submission', 'sign_requested', { token: 'USDC' });
    trackFunnelStep('invoice_submission', 'completed', { token: 'USDC', invoiceId: '123' });

    expect(trackEvent).toHaveBeenCalledTimes(5);
    expect(trackEvent).toHaveBeenCalledWith('funnel_invoice_submission_started', {
      flow: 'invoice_submission',
      stage: 'started',
      token: 'USDC',
    });
    expect(trackEvent).toHaveBeenCalledWith('funnel_invoice_submission_completed', {
      flow: 'invoice_submission',
      stage: 'completed',
      token: 'USDC',
      invoiceId: '123',
    });
  });

  it('calculates funnel conversion and completion rates', () => {
    const report = getFunnelAnalyticsReport();
    expect(report.length).toBe(3);

    const invoiceReport = report.find((r) => r.flow === 'invoice_submission');
    expect(invoiceReport).toBeDefined();
    expect(invoiceReport?.label).toBe('Invoice Submission Stepper');
    expect(invoiceReport?.totalStarts).toBeGreaterThan(0);
    expect(invoiceReport?.totalCompletions).toBeGreaterThan(0);
    expect(invoiceReport?.completionRate).toBeGreaterThan(0);
    expect(invoiceReport?.stages.length).toBeGreaterThan(0);
  });

  it('maintains data-minimization privacy principles (no PII, no private keys)', () => {
    trackFunnelStep('lp_funding', 'amount_entered', {
      token: 'USDC',
      stepIndex: 2,
    });

    const calls = vi.mocked(trackEvent).mock.calls;
    const payload = calls[0][1] as Record<string, unknown>;

    expect(payload).not.toHaveProperty('privateKey');
    expect(payload).not.toHaveProperty('secretSeed');
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('ip');
    expect(payload.flow).toBe('lp_funding');
    expect(payload.stage).toBe('amount_entered');
    expect(payload.token).toBe('USDC');
  });
});
