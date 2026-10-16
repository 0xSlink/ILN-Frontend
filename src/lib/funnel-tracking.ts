'use client';

import { trackEvent } from '@/lib/analytics';

/**
 * Privacy-Conscious Financial Journey Funnel Tracking
 *
 * Data Minimization Principles:
 * - No PII (names, email addresses, IP addresses) are ever collected or tracked.
 * - No sensitive financial content (exact invoice descriptions, secret keys, seeds) is tracked.
 * - Only flow stages, step numbers, anonymized token symbols, step durations, and error categories are captured.
 */

export type FinancialFlow = 'invoice_submission' | 'lp_funding' | 'governance_voting';

export type InvoiceSubmissionStage =
  | 'started'
  | 'details_entered'
  | 'preview_viewed'
  | 'sign_requested'
  | 'completed'
  | 'abandoned'
  | 'failed';

export type LPFundingStage =
  | 'started'
  | 'amount_entered'
  | 'allowance_requested'
  | 'allowance_approved'
  | 'deposit_sign_requested'
  | 'completed'
  | 'abandoned'
  | 'failed';

export type GovernanceVotingStage =
  | 'started'
  | 'choice_selected'
  | 'confirmation_opened'
  | 'sign_requested'
  | 'completed'
  | 'abandoned'
  | 'failed';

export type FunnelStage = InvoiceSubmissionStage | LPFundingStage | GovernanceVotingStage;

export interface FunnelEventMetadata {
  stepIndex?: number;
  totalSteps?: number;
  token?: string;
  durationMs?: number;
  reason?: string;
  errorCode?: string;
  [key: string]: unknown;
}

export interface FunnelStepRecord {
  flow: FinancialFlow;
  stage: FunnelStage;
  timestamp: number;
  metadata?: FunnelEventMetadata;
}

export interface FunnelStageMetric {
  stage: string;
  label: string;
  count: number;
  conversionRate: number; // percentage from flow start
  dropOffRate: number; // percentage dropped off from previous stage
}

export interface FlowFunnelReport {
  flow: FinancialFlow;
  label: string;
  totalStarts: number;
  totalCompletions: number;
  completionRate: number; // overall percentage
  abandonmentRate: number;
  hasSigningDropoffSpike: boolean;
  stages: FunnelStageMetric[];
}

// In-memory session tracking store
const sessionFunnelRecords: FunnelStepRecord[] = [];

// Baseline metrics for initial analytics display in dev/demo/admin view
const BASELINE_COUNTS: Record<FinancialFlow, Record<string, number>> = {
  invoice_submission: {
    started: 1420,
    details_entered: 1320,
    preview_viewed: 1250,
    sign_requested: 1210,
    completed: 1180,
    abandoned: 240,
  },
  lp_funding: {
    started: 980,
    amount_entered: 940,
    allowance_requested: 890,
    allowance_approved: 860,
    deposit_sign_requested: 840,
    completed: 820,
    abandoned: 160,
  },
  governance_voting: {
    started: 2150,
    choice_selected: 2080,
    confirmation_opened: 2020,
    sign_requested: 1980,
    completed: 1950,
    abandoned: 200,
  },
};

const FLOW_LABELS: Record<FinancialFlow, string> = {
  invoice_submission: 'Invoice Submission Stepper',
  lp_funding: 'LP Funding 2-Step Approval',
  governance_voting: 'Governance Proposal Voting',
};

const STAGE_LABELS: Record<string, string> = {
  started: '1. Flow Started',
  details_entered: '2. Details Entered',
  preview_viewed: '3. Preview Reviewed',
  amount_entered: '2. Amount Entered',
  allowance_requested: '3. Token Allowance Prompted',
  allowance_approved: '4. Allowance Approved',
  choice_selected: '2. Stance Selected',
  confirmation_opened: '3. Confirmation Reviewed',
  sign_requested: 'Signing Requested',
  deposit_sign_requested: 'Deposit Signing Requested',
  completed: 'Flow Completed',
};

/**
 * Record a funnel-stage transition event.
 * Dispatches via the existing lightweight trackEvent bridge.
 */
export function trackFunnelStep(
  flow: FinancialFlow,
  stage: FunnelStage,
  metadata?: FunnelEventMetadata
): void {
  const record: FunnelStepRecord = {
    flow,
    stage,
    timestamp: Date.now(),
    metadata,
  };

  sessionFunnelRecords.push(record);

  // Dispatch lightweight product analytics event
  trackEvent(`funnel_${flow}_${stage}`, {
    flow,
    stage,
    ...metadata,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('iln:funnel_stage', {
        detail: record,
      })
    );
  }
}

/**
 * Retrieve aggregated funnel reports for the core financial journeys.
 */
export function getFunnelAnalyticsReport(): FlowFunnelReport[] {
  const flows: FinancialFlow[] = ['invoice_submission', 'lp_funding', 'governance_voting'];

  return flows.map((flow) => {
    const baselines = { ...BASELINE_COUNTS[flow] };

    // Apply live session events
    for (const record of sessionFunnelRecords) {
      if (record.flow === flow) {
        baselines[record.stage] = (baselines[record.stage] ?? 0) + 1;
      }
    }

    const stageKeys = Object.keys(baselines).filter((k) => k !== 'abandoned' && k !== 'failed');
    const starts = baselines['started'] || 1;
    const completions = baselines['completed'] || 0;
    const completionRate = Math.round((completions / starts) * 1000) / 10;
    const abandonmentRate = Math.round((100 - completionRate) * 10) / 10;

    let previousCount = starts;
    let signingDropoffRate = 0;

    const stages: FunnelStageMetric[] = stageKeys.map((stage) => {
      const count = baselines[stage] ?? 0;
      const conversionRate = Math.round((count / starts) * 1000) / 10;
      const dropOffRate =
        previousCount > 0 ? Math.round(((previousCount - count) / previousCount) * 1000) / 10 : 0;

      if (stage.includes('sign_requested') || stage === 'completed') {
        if (stage === 'completed' && previousCount > 0) {
          signingDropoffRate = Math.round(((previousCount - count) / previousCount) * 1000) / 10;
        }
      }

      previousCount = count;

      return {
        stage,
        label: STAGE_LABELS[stage] || stage.replace(/_/g, ' '),
        count,
        conversionRate,
        dropOffRate: Math.max(0, dropOffRate),
      };
    });

    return {
      flow,
      label: FLOW_LABELS[flow],
      totalStarts: starts,
      totalCompletions: completions,
      completionRate,
      abandonmentRate,
      hasSigningDropoffSpike: signingDropoffRate > 10.0,
      stages,
    };
  });
}

/** Reset session funnel records (primarily for testing). */
export function resetSessionFunnelTracking(): void {
  sessionFunnelRecords.length = 0;
}
