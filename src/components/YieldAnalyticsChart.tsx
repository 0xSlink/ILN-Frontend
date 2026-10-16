'use client';

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Invoice } from '@/utils/soroban';
import { buildYieldTimeSeries, calcAvgWeeklyYieldPct, YieldRange } from '@/utils/yield-timeseries';

interface YieldAnalyticsChartProps {
  invoices: Invoice[];
  lpAddress: string;
  isLoading?: boolean;
}

const RANGES: YieldRange[] = [30, 60, 90] as unknown as YieldRange[];

const TOKEN_COLORS: Record<string, string> = {
  USDC: '#6366f1',
  EURC: '#06b6d4',
  XLM: '#8b5cf6',
};

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-label="Loading yield chart">
      <div className="h-4 w-32 rounded bg-surface-variant" />
      <div className="h-64 w-full rounded-xl bg-surface-variant" />
    </div>
  );
}

export default function YieldAnalyticsChart({
  invoices,
  lpAddress,
  isLoading = false,
}: YieldAnalyticsChartProps) {
  const [range, setRange] = useState<YieldRange>(30);

  if (isLoading) return <Skeleton />;

  const data = buildYieldTimeSeries(invoices, lpAddress, range);
  const avgWeeklyPct = calcAvgWeeklyYieldPct(invoices, lpAddress, range);

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Yield Analytics</h2>
          <p className="text-sm text-on-surface-variant">
            Avg weekly yield:{' '}
            <span className="font-bold text-green-600">{avgWeeklyPct.toFixed(3)}%</span>
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-surface-container-low p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                range === r
                  ? 'bg-primary text-surface-container-lowest shadow'
                  : 'text-on-surface-variant hover:bg-surface-variant/30'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-on-surface-variant">
          No paid invoices in the last {range} days.
        </p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-outline-variant)"
                opacity={0.15}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
              />
              <YAxis tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }} width={48} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface-container)',
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: '0.75rem',
                }}
                labelStyle={{ color: 'var(--color-on-surface)', fontWeight: 600 }}
                formatter={(v: number) => v.toFixed(4)}
              />
              <Legend />
              {(['USDC', 'EURC', 'XLM'] as const).map((sym) => (
                <Line
                  key={sym}
                  type="monotone"
                  dataKey={sym}
                  stroke={TOKEN_COLORS[sym]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                name="Cumulative"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
