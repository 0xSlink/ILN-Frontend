'use client';

import React, { useMemo } from 'react';
import { Invoice } from '@/utils/soroban';
import { calculateYield, formatTokenAmount } from '@/utils/format';
import { RISK_SORT_ORDER } from '@/utils/risk';

interface LPPortfolioSummaryProps {
  invoices: Invoice[];
  payerRisks: Map<string, string>;
  tokenMap: Map<string, any>;
  defaultToken: any;
}

function MetricCard({
  title,
  value,
  trend,
  trendDirection,
  sparklineData,
}: {
  title: string;
  value: React.ReactNode;
  trend: string;
  trendDirection: 'up' | 'down' | 'neutral';
  sparklineData: number[] | null;
}) {
  const trendColor =
    trendDirection === 'up'
      ? 'text-emerald-500'
      : trendDirection === 'down'
        ? 'text-red-500'
        : 'text-on-surface-variant';

  const trendIcon =
    trendDirection === 'up'
      ? 'trending_up'
      : trendDirection === 'down'
        ? 'trending_down'
        : 'trending_flat';

  // Handle unavailable sparkline data
  if (!sparklineData || sparklineData.length === 0) {
    return (
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 flex flex-col gap-2 shadow-sm">
        <h4 className="text-sm font-medium text-on-surface-variant">{title}</h4>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-on-surface-variant opacity-60">
            Historical data unavailable
          </div>
        </div>
      </div>
    );
  }

  // Simple sparkline path generator
  const max = Math.max(...sparklineData, 1);
  const min = Math.min(...sparklineData, 0);
  const range = max - min;
  const points = sparklineData.map((d, i) => {
    const x = (i / (sparklineData.length - 1)) * 100;
    const y = 100 - ((d - min) / range) * 100;
    return `${x},${y}`;
  });

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 flex flex-col gap-2 shadow-sm">
      <h4 className="text-sm font-medium text-on-surface-variant">{title}</h4>
      <div className="text-2xl font-bold">{value}</div>
      <div className="flex items-center justify-between mt-2">
        <div className={`flex items-center gap-1 text-xs font-bold ${trendColor}`}>
          <span className="material-symbols-outlined text-[16px]">{trendIcon}</span>
          {trend}
        </div>
        <svg
          viewBox="0 0 100 100"
          className="h-8 w-16 overflow-visible opacity-60"
          preserveAspectRatio="none"
        >
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={trendColor}
            points={points.join(' ')}
          />
        </svg>
      </div>
    </div>
  );
}

export default function LPPortfolioSummary({
  invoices,
  payerRisks,
  tokenMap: _tokenMap,
  defaultToken,
}: LPPortfolioSummaryProps) {
  const metrics = useMemo(() => {
    let totalInvested = 0n;
    let currentYield = 0n;
    let riskSum = 0;
    let riskCount = 0;

    invoices.forEach((inv) => {
      totalInvested += inv.amount;
      currentYield += calculateYield(inv.amount, inv.discount_rate);
      const risk = payerRisks.get(inv.payer);
      if (risk && risk in RISK_SORT_ORDER) {
        riskSum += RISK_SORT_ORDER[risk as keyof typeof RISK_SORT_ORDER] || 0;
        riskCount += 1;
      }
    });

    const averageRisk = riskCount > 0 ? Math.round(riskSum / riskCount) : 0;
    let riskLabel = 'Low';
    if (averageRisk >= 2) riskLabel = 'Medium';
    if (averageRisk >= 3) riskLabel = 'High';

    return {
      totalInvested,
      currentYield,
      activePositions: invoices.length,
      riskLabel,
    };
  }, [invoices, payerRisks]);

  // Historical sparkline data requires verified data sources
  // Currently unavailable - will be populated from indexer or contract data

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard
        title="Total Invested"
        value={formatTokenAmount(metrics.totalInvested, {
          symbol: defaultToken?.symbol ?? 'USDC',
          decimals: defaultToken?.decimals ?? 7,
        })}
        trend="Calculating"
        trendDirection="neutral"
        sparklineData={null}
      />
      <MetricCard
        title="Current Yield"
        value={formatTokenAmount(metrics.currentYield, {
          symbol: defaultToken?.symbol ?? 'USDC',
          decimals: defaultToken?.decimals ?? 7,
        })}
        trend="Calculating"
        trendDirection="neutral"
        sparklineData={null}
      />
      <MetricCard
        title="Active Positions"
        value={metrics.activePositions.toString()}
        trend={metrics.activePositions.toString()}
        trendDirection="neutral"
        sparklineData={null}
      />
      <MetricCard
        title="Risk Score"
        value={metrics.riskLabel}
        trend="Stable"
        trendDirection="neutral"
        sparklineData={null}
      />
    </div>
  );
}
