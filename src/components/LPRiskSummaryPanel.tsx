'use client';

import { useMemo } from 'react';
import type { Invoice } from '@/utils/soroban';
import { formatTokenAmount } from '@/utils/format';
import { deriveLPDataStatus, type LPDataStatus } from '@/utils/lp-capital-accounting';

/**
 * Maintainer-approved UI triage bands (#1265), documented in
 * `docs/lp-risk-and-capital-methodology.md`.
 *
 * They are presentation heuristics only: no on-chain parameter, transaction,
 * or settlement path reads these values. Changes require maintainer approval
 * and a documentation update so reviewers can compare behaviour across
 * releases. Until a governance-owned risk-parameter source exists, deriving
 * them from chain state would invent an authoritative source that does not
 * exist.
 */
export const LP_RISK_THRESHOLDS = {
  positionCount: { mediumPercent: 10, highPercent: 20 },
  capital: { mediumPercent: 15, highPercent: 25 },
} as const;

const NEAR_EXPIRY_WINDOW_MS = 24 * 60 * 60 * 1000;

type RiskLevel = 'low' | 'medium' | 'high';

interface RiskMetrics {
  positionsAtRisk: number;
  capitalAtRisk: bigint;
  disputedPositions: number;
  totalPositions: number;
  totalCapital: bigint;
}

interface LPRiskSummaryPanelProps {
  invoices: Invoice[];
  onFilterByRisk: (filterType: 'at-risk' | 'disputed' | 'all') => void;
  /** React Query `dataUpdatedAt` for the invoice read that produced `invoices`. */
  dataUpdatedAt?: number;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Injectable for deterministic tests; defaults to `Date.now()`. */
  now?: number;
}

function levelFromPercentage(
  percentage: number,
  thresholds: { mediumPercent: number; highPercent: number }
): RiskLevel {
  if (percentage >= thresholds.highPercent) return 'high';
  if (percentage >= thresholds.mediumPercent) return 'medium';
  return 'low';
}

function getRiskLevel(value: number, total: number): RiskLevel {
  if (total === 0) return 'low';
  return levelFromPercentage((value / total) * 100, LP_RISK_THRESHOLDS.positionCount);
}

function getCapitalRiskLevel(atRisk: bigint, total: bigint): RiskLevel {
  if (total === 0n) return 'low';
  // Two decimal places avoids integer truncation misclassifying 14.9% as low.
  const percentage = Number((atRisk * 10_000n) / total) / 100;
  return levelFromPercentage(percentage, LP_RISK_THRESHOLDS.capital);
}

const STATUS_COPY: Record<LPDataStatus, { label: string; detail: string }> = {
  loading: {
    label: 'Loading verified invoice data…',
    detail: 'Risk figures appear only after the invoice read completes.',
  },
  unavailable: {
    label: 'Invoice source unavailable',
    detail: 'Showing last-known values only — these figures are not live.',
  },
  stale: {
    label: 'Stale data (refreshing…)',
    detail: 'Showing last-known values from an older invoice read — not live.',
  },
  verified: {
    label: 'Verified invoice data',
    detail: 'Figures reflect the latest successful invoice read.',
  },
};

const RISK_STYLES: Record<RiskLevel, string> = {
  low: 'text-green-600 bg-green-50 border-green-200',
  medium: 'text-orange-600 bg-orange-50 border-orange-200',
  high: 'text-red-600 bg-red-50 border-red-200',
};

const RISK_ICONS: Record<RiskLevel, string> = {
  low: 'check_circle',
  medium: 'warning',
  high: 'error',
};

export default function LPRiskSummaryPanel({
  invoices,
  onFilterByRisk,
  dataUpdatedAt,
  isLoading = false,
  isError = false,
  onRetry,
  now,
}: LPRiskSummaryPanelProps) {
  const currentTime = now ?? Date.now();

  const riskMetrics = useMemo((): RiskMetrics => {
    const nowMs = currentTime;
    const twentyFourHoursFromNow = nowMs + NEAR_EXPIRY_WINDOW_MS;

    let positionsAtRisk = 0;
    let capitalAtRisk = 0n;
    let disputedPositions = 0;
    let totalCapital = 0n;

    invoices.forEach((invoice) => {
      const dueDateSeconds = Number(invoice.due_date);
      const dueDate = dueDateSeconds * 1000;
      const hasDueDate = Number.isFinite(dueDateSeconds) && dueDateSeconds > 0;
      const isNearExpiry = hasDueDate && dueDate <= twentyFourHoursFromNow && dueDate > nowMs;
      const isOverdue = hasDueDate && dueDate <= nowMs;
      const isDisputed = invoice.status === 'Disputed';
      const isFunded = invoice.status === 'Funded' || isDisputed;

      if (!isFunded) return;

      totalCapital += invoice.amount;
      if (isDisputed) {
        disputedPositions++;
        capitalAtRisk += invoice.amount;
      } else if (isNearExpiry || isOverdue) {
        positionsAtRisk++;
        capitalAtRisk += invoice.amount;
      }
    });

    return {
      positionsAtRisk,
      capitalAtRisk,
      disputedPositions,
      totalPositions: invoices.filter(
        (invoice) => invoice.status === 'Funded' || invoice.status === 'Disputed'
      ).length,
      totalCapital,
    };
  }, [invoices, currentTime]);

  const dataStatus = deriveLPDataStatus({ isLoading, isError, dataUpdatedAt, now: currentTime });

  const positionRiskLevel = getRiskLevel(
    riskMetrics.positionsAtRisk + riskMetrics.disputedPositions,
    riskMetrics.totalPositions
  );
  const capitalRiskLevel = getCapitalRiskLevel(riskMetrics.capitalAtRisk, riskMetrics.totalCapital);
  const disputeRiskLevel = getRiskLevel(riskMetrics.disputedPositions, riskMetrics.totalPositions);

  // Hide only an empty *verified* portfolio (or a bare render with no query
  // state). Loading/error/stale reads stay visible with an explicit status so
  // an interrupted read is never silently shown as an empty live portfolio.
  const hasQueryState = isLoading || isError || dataUpdatedAt !== undefined;
  if (riskMetrics.totalPositions === 0 && (!hasQueryState || dataStatus === 'verified')) {
    return null;
  }

  const statusCopy = STATUS_COPY[dataStatus];
  const updatedAtLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : 'Not verified';

  return (
    <div
      className="bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/10 p-6 mb-6"
      data-testid="lp-risk-summary"
      data-status={dataStatus}
      aria-busy={dataStatus === 'loading'}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">shield</span>
            Risk Summary
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            Overview of your portfolio risk exposure
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-on-surface-variant">
            {dataStatus === 'verified' ? 'Last updated' : 'Read status'}
          </div>
          <div className="text-sm font-medium">
            {dataStatus === 'verified' ? updatedAtLabel : statusCopy.label}
          </div>
        </div>
      </div>

      <div
        className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm ${
          dataStatus === 'unavailable'
            ? 'border-error/30 bg-error/10 text-error'
            : dataStatus === 'stale'
              ? 'border-orange-200 bg-orange-50 text-orange-700'
              : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant'
        }`}
        data-testid="lp-risk-data-status"
        data-status={dataStatus}
        role={dataStatus === 'unavailable' ? 'alert' : 'status'}
        aria-live={dataStatus === 'unavailable' ? 'assertive' : 'polite'}
      >
        <span>
          <span className="font-semibold">{statusCopy.label}</span> {statusCopy.detail}
        </span>
        {(dataStatus === 'unavailable' || dataStatus === 'stale') && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-current px-3 py-1 text-xs font-bold"
          >
            Retry
          </button>
        )}
      </div>

      {dataStatus === 'verified' && (
        <p className="mb-4 text-xs text-on-surface-variant/80">
          Verified as of{' '}
          <time dateTime={new Date(dataUpdatedAt!).toISOString()}>{updatedAtLabel}</time>.
        </p>
      )}

      {riskMetrics.totalPositions > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => onFilterByRisk('at-risk')}
              className={`p-4 rounded-xl border-2 transition-all hover:shadow-md text-left ${RISK_STYLES[positionRiskLevel]}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-2xl">
                  {RISK_ICONS[positionRiskLevel]}
                </span>
                <span className="text-xs font-bold uppercase tracking-wide opacity-80">
                  {positionRiskLevel} risk
                </span>
              </div>
              <div className="text-2xl font-bold mb-1">{riskMetrics.positionsAtRisk}</div>
              <div className="text-sm font-medium mb-1">Positions at Risk</div>
              <div className="text-xs opacity-80">Disputed or expiring within 24h</div>
              {riskMetrics.positionsAtRisk > 0 && (
                <div className="mt-2 text-xs font-medium">Click to filter →</div>
              )}
            </button>

            <button
              onClick={() => onFilterByRisk('at-risk')}
              className={`p-4 rounded-xl border-2 transition-all hover:shadow-md text-left ${RISK_STYLES[capitalRiskLevel]}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-2xl">
                  {RISK_ICONS[capitalRiskLevel]}
                </span>
                <span className="text-xs font-bold uppercase tracking-wide opacity-80">
                  {capitalRiskLevel} risk
                </span>
              </div>
              <div className="text-2xl font-bold mb-1">
                {formatTokenAmount(riskMetrics.capitalAtRisk, { decimals: 7, symbol: 'USDC' })}
              </div>
              <div className="text-sm font-medium mb-1">Capital at Risk</div>
              <div className="text-xs opacity-80">
                {riskMetrics.totalCapital > 0n
                  ? `${Number((riskMetrics.capitalAtRisk * 100n) / riskMetrics.totalCapital)}% of portfolio`
                  : '0% of portfolio'}
              </div>
              {riskMetrics.capitalAtRisk > 0n && (
                <div className="mt-2 text-xs font-medium">Click to filter →</div>
              )}
            </button>

            <button
              onClick={() => onFilterByRisk('disputed')}
              className={`p-4 rounded-xl border-2 transition-all hover:shadow-md text-left ${RISK_STYLES[disputeRiskLevel]}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-2xl">
                  {RISK_ICONS[disputeRiskLevel]}
                </span>
                <span className="text-xs font-bold uppercase tracking-wide opacity-80">
                  {disputeRiskLevel} risk
                </span>
              </div>
              <div className="text-2xl font-bold mb-1">{riskMetrics.disputedPositions}</div>
              <div className="text-sm font-medium mb-1">Disputed Positions</div>
              <div className="text-xs opacity-80">Positions under dispute</div>
              {riskMetrics.disputedPositions > 0 && (
                <div className="mt-2 text-xs font-medium">Click to filter →</div>
              )}
            </button>
          </div>

          <p
            className="mt-4 text-xs text-on-surface-variant/80"
            data-testid="lp-risk-methodology"
            title="Documented UI triage bands, not protocol-enforced limits"
          >
            Methodology: positions ≥10% medium / ≥20% high; capital ≥15% medium / ≥25% high. UI
            triage only — not protocol policy.
          </p>

          {(riskMetrics.positionsAtRisk > 0 || riskMetrics.disputedPositions > 0) && (
            <div className="mt-6 p-4 bg-surface-container-low rounded-xl">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-orange-600 mt-0.5">info</span>
                <div>
                  <div className="font-medium text-on-surface mb-1">
                    Risk Management Recommendations
                  </div>
                  <ul className="text-sm text-on-surface-variant space-y-1">
                    {riskMetrics.positionsAtRisk > 0 && (
                      <li>• Monitor positions nearing expiry for payment status</li>
                    )}
                    {riskMetrics.disputedPositions > 0 && (
                      <li>• Review disputed positions and consider resolution actions</li>
                    )}
                    {capitalRiskLevel === 'high' && (
                      <li>• Consider diversifying portfolio to reduce concentration risk</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
