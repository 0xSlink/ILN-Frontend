'use client';

import { useMemo } from 'react';
import type { Invoice } from '@/utils/soroban';
import { formatTokenAmount } from '@/utils/format';

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
}

export default function LPRiskSummaryPanel({ invoices, onFilterByRisk }: LPRiskSummaryPanelProps) {
  const riskMetrics = useMemo((): RiskMetrics => {
    const now = Date.now();
    const twentyFourHoursFromNow = now + 24 * 60 * 60 * 1000;

    let positionsAtRisk = 0;
    let capitalAtRisk = 0n;
    let disputedPositions = 0;
    let totalCapital = 0n;

    invoices.forEach((invoice) => {
      const dueDate = Number(invoice.due_date) * 1000;
      const isNearExpiry = dueDate <= twentyFourHoursFromNow && dueDate > now;
      const isOverdue = dueDate <= now;
      const isDisputed = invoice.status === 'Disputed';
      const isFunded = invoice.status === 'Funded' || isDisputed;

      if (isFunded) {
        totalCapital += invoice.amount;

        if (isDisputed) {
          disputedPositions++;
          capitalAtRisk += invoice.amount;
        } else if (isNearExpiry || isOverdue) {
          positionsAtRisk++;
          capitalAtRisk += invoice.amount;
        }
      }
    });

    return {
      positionsAtRisk,
      capitalAtRisk,
      disputedPositions,
      totalPositions: invoices.filter((inv) => inv.status === 'Funded' || inv.status === 'Disputed')
        .length,
      totalCapital,
    };
  }, [invoices]);

  const getRiskLevel = (value: number, total: number): 'low' | 'medium' | 'high' => {
    if (total === 0) return 'low';
    const percentage = (value / total) * 100;
    if (percentage >= 20) return 'high';
    if (percentage >= 10) return 'medium';
    return 'low';
  };

  const getCapitalRiskLevel = (atRisk: bigint, total: bigint): 'low' | 'medium' | 'high' => {
    if (total === 0n) return 'low';
    const percentage = Number((atRisk * 100n) / total);
    if (percentage >= 25) return 'high';
    if (percentage >= 15) return 'medium';
    return 'low';
  };

  const positionRiskLevel = getRiskLevel(
    riskMetrics.positionsAtRisk + riskMetrics.disputedPositions,
    riskMetrics.totalPositions
  );
  const capitalRiskLevel = getCapitalRiskLevel(riskMetrics.capitalAtRisk, riskMetrics.totalCapital);
  const disputeRiskLevel = getRiskLevel(riskMetrics.disputedPositions, riskMetrics.totalPositions);

  const getRiskColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'medium':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const getRiskIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return 'check_circle';
      case 'medium':
        return 'warning';
      case 'high':
        return 'error';
    }
  };

  if (riskMetrics.totalPositions === 0) {
    return null; // Don't show panel if no funded positions
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/10 p-6 mb-6">
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
          <div className="text-sm text-on-surface-variant">Last updated</div>
          <div className="text-sm font-medium">{new Date().toLocaleTimeString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Positions at Risk */}
        <button
          onClick={() => onFilterByRisk('at-risk')}
          className={`p-4 rounded-xl border-2 transition-all hover:shadow-md text-left ${getRiskColor(
            positionRiskLevel
          )}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="material-symbols-outlined text-2xl">
              {getRiskIcon(positionRiskLevel)}
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

        {/* Capital at Risk */}
        <button
          onClick={() => onFilterByRisk('at-risk')}
          className={`p-4 rounded-xl border-2 transition-all hover:shadow-md text-left ${getRiskColor(
            capitalRiskLevel
          )}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="material-symbols-outlined text-2xl">
              {getRiskIcon(capitalRiskLevel)}
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
              ? `${Number(
                  (riskMetrics.capitalAtRisk * 100n) / riskMetrics.totalCapital
                )}% of portfolio`
              : '0% of portfolio'}
          </div>
          {riskMetrics.capitalAtRisk > 0n && (
            <div className="mt-2 text-xs font-medium">Click to filter →</div>
          )}
        </button>

        {/* Disputed Positions */}
        <button
          onClick={() => onFilterByRisk('disputed')}
          className={`p-4 rounded-xl border-2 transition-all hover:shadow-md text-left ${getRiskColor(
            disputeRiskLevel
          )}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="material-symbols-outlined text-2xl">
              {getRiskIcon(disputeRiskLevel)}
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

      {/* Additional Risk Insights */}
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
    </div>
  );
}
