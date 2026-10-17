import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FunnelAnalyticsPanel from '@/components/admin/FunnelAnalyticsPanel';
import { recordSigningAttempt, resetSigningAlertState } from '@/lib/signing-alert';
import { resetSessionFunnelTracking } from '@/lib/funnel-tracking';

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));

describe('FunnelAnalyticsPanel', () => {
  beforeEach(() => {
    resetSigningAlertState();
    resetSessionFunnelTracking();
    vi.clearAllMocks();
  });

  it('renders funnel analytics panel with all 3 core financial journeys', () => {
    render(<FunnelAnalyticsPanel />);

    expect(screen.getByText('Financial Journey Funnel & Signing Analytics')).toBeInTheDocument();
    expect(screen.getByText('Invoice Submission Stepper')).toBeInTheDocument();
    expect(screen.getByText('LP Funding 2-Step Approval')).toBeInTheDocument();
    expect(screen.getByText('Governance Proposal Voting')).toBeInTheDocument();
    expect(screen.getByText(/Privacy-Conscious Data Minimization/i)).toBeInTheDocument();
  });

  it('filters visible flows using tab buttons', () => {
    render(<FunnelAnalyticsPanel />);

    expect(screen.getByText('Invoice Submission Stepper')).toBeInTheDocument();
    expect(screen.getByText('LP Funding 2-Step Approval')).toBeInTheDocument();

    // Filter to Invoice Submissions only
    fireEvent.click(screen.getByRole('button', { name: 'Invoice Submissions' }));
    expect(screen.getByText('Invoice Submission Stepper')).toBeInTheDocument();
    expect(screen.queryByText('LP Funding 2-Step Approval')).not.toBeInTheDocument();
    expect(screen.queryByText('Governance Proposal Voting')).not.toBeInTheDocument();

    // Filter to LP Funding only
    fireEvent.click(screen.getByRole('button', { name: 'LP Funding' }));
    expect(screen.queryByText('Invoice Submission Stepper')).not.toBeInTheDocument();
    expect(screen.getByText('LP Funding 2-Step Approval')).toBeInTheDocument();
  });

  it('displays optimal signing health status when no alerts are active', () => {
    render(<FunnelAnalyticsPanel />);

    expect(screen.getByText(/Signing Pipeline Health: Optimal/i)).toBeInTheDocument();
  });

  it('displays active SEV-1 banner when a transaction-signing failure spike is triggered', () => {
    const { rerender } = render(<FunnelAnalyticsPanel />);

    // Trigger a signing failure spike
    recordSigningAttempt({ flow: 'invoice_submission', success: false, errorMessage: 'RPC fail' });
    recordSigningAttempt({
      flow: 'invoice_submission',
      success: false,
      errorMessage: 'Key rejected',
    });
    recordSigningAttempt({
      flow: 'invoice_submission',
      success: false,
      errorMessage: 'Host timeout',
    });

    rerender(<FunnelAnalyticsPanel />);

    expect(screen.getByTestId('signing-alert-banner')).toBeInTheDocument();
    expect(screen.getByText('SEV-1 ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Transaction-Signing Failure Rate Spike Detected')).toBeInTheDocument();
  });
});
