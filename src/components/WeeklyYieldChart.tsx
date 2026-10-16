'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TokenYieldMetrics } from '@/utils/per-token-yield';

interface WeeklyYieldChartProps {
  invoices: any[];
  metrics: TokenYieldMetrics[];
  showUSDEquivalent: boolean;
}

interface ChartDataPoint {
  week: string;
  [tokenSymbol: string]: number | string;
}

export default function WeeklyYieldChart({
  invoices,
  metrics,
  showUSDEquivalent: _showUSDEquivalent,
}: WeeklyYieldChartProps) {
  if (invoices.length === 0 || metrics.length === 0) {
    return null;
  }

  // Group paid invoices by week and token
  const weeklyData = new Map<string, Record<string, bigint>>();
  const tokenSymbols = new Set<string>();

  invoices
    .filter((inv) => inv.status === 'Paid' && inv.funded_at)
    .forEach((inv) => {
      const token = metrics.find(
        (m) => m.token.contractId === (inv.token || metrics[0]?.token.contractId)
      );
      if (!token) return;

      const fundedDate = new Date(Number(inv.funded_at) * 1000);
      const weekStart = new Date(fundedDate);
      weekStart.setDate(fundedDate.getDate() - fundedDate.getDay());
      const weekKey = weekStart.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      tokenSymbols.add(token.token.symbol);

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {});
      }

      const weekRecord = weeklyData.get(weekKey)!;
      const currentYield = (weekRecord[token.token.symbol] ?? 0n) as bigint;
      const yieldAmount = (inv.amount * BigInt(inv.discount_rate)) / 10000n;
      weekRecord[token.token.symbol] = currentYield + yieldAmount;
    });

  // Convert to chart format (convert bigint to number)
  const chartData: ChartDataPoint[] = Array.from(weeklyData.entries()).map(
    ([week, tokenYields]) => {
      const dataPoint: ChartDataPoint = { week };
      Object.entries(tokenYields).forEach(([symbol, yield_]) => {
        // Convert from smallest unit to token amount
        const yieldBigInt = yield_ as bigint;
        const tokenMetric = metrics.find((m) => m.token.symbol === symbol);
        if (tokenMetric) {
          const divisor = 10 ** tokenMetric.token.decimals;
          dataPoint[symbol] = Number(yieldBigInt) / divisor;
        }
      });
      return dataPoint;
    }
  );

  // Sort chronologically
  chartData.sort((a, b) => {
    const dateA = new Date(`${a.week} 2026`);
    const dateB = new Date(`${b.week} 2026`);
    return dateA.getTime() - dateB.getTime();
  });

  // Color palette for tokens
  const colors = ['#6366f1', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6">
      <h2 className="mb-6 font-headline text-xl font-bold text-on-surface">
        Weekly Yield Breakdown by Token
      </h2>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-outline-variant)"
              opacity={0.1}
            />
            <XAxis
              dataKey="week"
              tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }}
            />
            <YAxis
              tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }}
              label={{ value: 'Yield (Token Amount)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-surface-container)',
                border: '1px solid var(--color-outline-variant)',
              }}
              labelStyle={{ color: 'var(--color-on-surface)' }}
              formatter={(value: number) => value.toFixed(4)}
            />
            <Legend />
            {Array.from(tokenSymbols).map((symbol, idx) => (
              <Bar
                key={symbol}
                dataKey={symbol}
                fill={colors[idx % colors.length]}
                radius={[8, 8, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 text-xs text-on-surface-variant italic">
        Chart shows yield earned per week, grouped by token. Values are in native token amounts.
      </p>
    </div>
  );
}
