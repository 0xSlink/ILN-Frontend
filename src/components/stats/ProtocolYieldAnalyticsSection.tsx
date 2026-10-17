'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Invoice } from '@/utils/soroban';
import {
  buildProtocolYieldTrend,
  computeProtocolYieldMetrics,
} from '@/utils/protocol-yield-analytics';

interface ProtocolYieldAnalyticsSectionProps {
  invoices: Invoice[];
  isLoading?: boolean;
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[20px] border border-outline-variant/10 bg-surface-container-lowest p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className="mt-2 text-2xl font-bold text-on-surface">{value}</p>
      {sub ? <p className="mt-1 text-xs text-on-surface-variant">{sub}</p> : null}
    </div>
  );
}

export default function ProtocolYieldAnalyticsSection({
  invoices,
  isLoading = false,
}: ProtocolYieldAnalyticsSectionProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4" aria-label="Loading yield analytics">
        <div className="h-6 w-48 rounded bg-surface-variant" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-[20px] border border-outline-variant/10 bg-surface-container-lowest"
            />
          ))}
        </div>
        <div className="h-72 rounded-[24px] border border-outline-variant/10 bg-surface-container-lowest" />
      </div>
    );
  }

  const metrics = computeProtocolYieldMetrics(invoices);
  const trend = buildProtocolYieldTrend(invoices, 90);

  return (
    <section className="flex flex-col gap-6" aria-labelledby="yield-analytics-heading">
      <div>
        <h2
          id="yield-analytics-heading"
          className="font-headline text-xl font-bold text-on-surface"
        >
          Yield Analytics
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Aggregated from settled invoice data (funded and paid) across the protocol.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Avg Effective Yield (30d)"
          value={`${metrics.avgEffectiveYield30d.toFixed(2)}%`}
          sub="Annualized"
        />
        <MetricCard
          label="Median Discount Rate"
          value={`${metrics.medianDiscountRatePct.toFixed(2)}%`}
        />
        <MetricCard
          label="Highest Yield This Week"
          value={metrics.highestThisWeek ? `#${metrics.highestThisWeek.id}` : '—'}
          sub={
            metrics.highestThisWeek
              ? `${metrics.highestThisWeek.effectiveYieldPct.toFixed(2)}% · ${
                  metrics.highestThisWeek.symbol
                }`
              : 'No funded invoices this week'
          }
        />
        <MetricCard
          label="Lowest Yield This Week"
          value={metrics.lowestThisWeek ? `#${metrics.lowestThisWeek.id}` : '—'}
          sub={
            metrics.lowestThisWeek
              ? `${metrics.lowestThisWeek.effectiveYieldPct.toFixed(2)}% · ${
                  metrics.lowestThisWeek.symbol
                }`
              : 'No funded invoices this week'
          }
        />
      </div>

      <div className="rounded-[24px] border border-outline-variant/10 bg-surface-container-lowest p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">
          Yield by Token (30d)
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {metrics.yieldByToken.map((row) => (
            <div key={row.symbol} className="rounded-xl bg-surface-container-low p-4">
              <p className="text-xs font-bold text-on-surface-variant">{row.symbol}</p>
              <p className="mt-1 text-lg font-bold text-primary">
                {row.avgEffectiveYieldPct.toFixed(2)}%
              </p>
              <p className="text-xs text-on-surface-variant">
                {row.invoiceCount} settled invoice{row.invoiceCount === 1 ? '' : 's'}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-outline-variant/10 bg-surface-container-lowest p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">
          Average Yield Over Time (90d)
        </h3>
        {trend.length === 0 ? (
          <p className="py-12 text-center text-sm text-on-surface-variant">
            No settled invoice data in the last 90 days.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-outline-variant)"
                  opacity={0.15}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
                  width={48}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-container)',
                    border: '1px solid var(--color-outline-variant)',
                    borderRadius: '0.75rem',
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Avg yield']}
                />
                <Line
                  type="monotone"
                  dataKey="avgYieldPct"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  name="Avg effective yield"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
