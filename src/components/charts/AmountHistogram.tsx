import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { Invoice } from '@/utils/soroban';
import { tokenAmountToNumber } from '@/utils/format';

/** Buckets: $0–$100, $101–$500, $501–$1k, $1k–$5k, $5k–$10k, $10k+ */
export const BUCKET_LABELS = ['$0–$100', '$101–$500', '$501–$1k', '$1k–$5k', '$5k–$10k', '$10k+'];

export interface HistogramBucket {
  bucket: string;
  count: number;
  volume: number;
  funded: number;
  paid: number;
  defaulted: number;
  pending: number;
  volume_funded: number;
  volume_paid: number;
  volume_defaulted: number;
  volume_pending: number;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Assigns an amount to a bucket index */
export function getBucketIndex(amountUsdc: number): number {
  if (amountUsdc <= 100) return 0;
  if (amountUsdc <= 500) return 1;
  if (amountUsdc <= 1000) return 2;
  if (amountUsdc <= 5000) return 3;
  if (amountUsdc <= 10000) return 4;
  return 5;
}

/** Aggregates invoices into buckets for the histogram */
export function aggregateHistogramData(invoices: Invoice[]): HistogramBucket[] {
  const result: HistogramBucket[] = BUCKET_LABELS.map((label) => ({
    bucket: label,
    count: 0,
    volume: 0,
    funded: 0,
    paid: 0,
    defaulted: 0,
    pending: 0,
    volume_funded: 0,
    volume_paid: 0,
    volume_defaulted: 0,
    volume_pending: 0,
  }));

  invoices.forEach((inv) => {
    const amountUsdc = tokenAmountToNumber(inv.amount);
    const idx = getBucketIndex(amountUsdc);

    result[idx].count += 1;
    result[idx].volume += amountUsdc;

    const status = (inv.status || 'Pending').toLowerCase();
    if (status === 'funded') {
      result[idx].funded += 1;
      result[idx].volume_funded += amountUsdc;
    } else if (status === 'paid') {
      result[idx].paid += 1;
      result[idx].volume_paid += amountUsdc;
    } else if (status === 'defaulted') {
      result[idx].defaulted += 1;
      result[idx].volume_defaulted += amountUsdc;
    } else {
      result[idx].pending += 1;
      result[idx].volume_pending += amountUsdc;
    }
  });

  return result;
}

/** Calculates the median invoice amount */
export function calculateMedian(invoices: Invoice[]): number {
  if (invoices.length === 0) return 0;
  const amounts = invoices.map((inv) => tokenAmountToNumber(inv.amount)).sort((a, b) => a - b);

  const mid = Math.floor(amounts.length / 2);
  if (amounts.length % 2 !== 0) {
    return amounts[mid];
  }
  return (amounts[mid - 1] + amounts[mid]) / 2;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface AmountHistogramProps {
  invoices: Invoice[];
}

export default function AmountHistogram({ invoices }: AmountHistogramProps) {
  const [yScale, setYScale] = useState<'count' | 'volume'>('count');

  const data = useMemo(() => aggregateHistogramData(invoices), [invoices]);
  const median = useMemo(() => calculateMedian(invoices), [invoices]);

  const mostCommonBucket = useMemo(() => {
    if (data.length === 0) return 'N/A';
    const sorted = [...data].sort((a, b) => b.count - a.count);
    return sorted[0].count > 0 ? sorted[0].bucket : 'N/A';
  }, [data]);

  // Color tokens (Standard Material/Fiscal Atelier theme)
  const COLORS = {
    funded: 'var(--color-primary, #008080)', // Teal-ish
    paid: 'var(--color-success, #2e7d32)', // Green
    defaulted: 'var(--color-error, #d32f2f)', // Red
    pending: 'var(--color-outline, #9e9e9e)', // Gray
  };

  const formatValue = (val: number) => {
    if (yScale === 'volume')
      return `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    return val.toLocaleString();
  };

  return (
    <div className="flex flex-col gap-6 rounded-[24px] border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-headline text-xl font-bold text-on-surface">
            Invoice Size Distribution
          </h3>
          <p className="text-sm text-on-surface-variant">Breakdown of invoice amounts by status</p>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-1 p-1 bg-surface-container rounded-xl self-start">
          <button
            onClick={() => setYScale('count')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              yScale === 'count'
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Invoice Count
          </button>
          <button
            onClick={() => setYScale('volume')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              yScale === 'volume'
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            USDC Volume
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
            Most Common Size
          </p>
          <p className="text-2xl font-bold text-primary">{mostCommonBucket}</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
            Median Invoice Amount
          </p>
          <p className="text-2xl font-bold text-on-surface">
            ${median.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="h-[300px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--color-outline-variant, #334155)"
              strokeOpacity={0.2}
            />
            <XAxis
              dataKey="bucket"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12, fontWeight: 500 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }}
              tickFormatter={(v: number) =>
                yScale === 'volume' && v >= 1000 ? `${v / 1000}k` : v.toString()
              }
            />
            <Tooltip
              cursor={{ fill: 'var(--color-surface-container-high)', opacity: 0.4 }}
              content={(props: TooltipProps<number, string>) => {
                const { active, payload, label } = props;
                if (active && payload && payload.length) {
                  const total = payload.reduce(
                    (acc: number, entry) => acc + ((entry.value as number) ?? 0),
                    0
                  );
                  return (
                    <div className="bg-surface-container-lowest border border-outline-variant/20 p-4 rounded-2xl shadow-xl">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                        {label}
                      </p>
                      <div className="flex flex-col gap-2">
                        {payload.map((entry) => (
                          <div key={entry.name} className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-xs font-medium text-on-surface capitalize">
                                {entry.name}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-on-surface">
                              {yScale === 'volume'
                                ? `$${Number(entry.value).toLocaleString()}`
                                : entry.value}
                            </span>
                          </div>
                        ))}
                        <div className="h-px bg-outline-variant/10 my-1" />
                        <div className="flex items-center justify-between gap-6">
                          <span className="text-xs font-bold text-on-surface">Total</span>
                          <span className="text-xs font-extrabold text-primary">
                            {formatValue(total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              wrapperStyle={{ paddingTop: 20, fontSize: 12, fontWeight: 500 }}
              formatter={(value: string) => (
                <span className="text-on-surface-variant capitalize">{value}</span>
              )}
            />

            {/* Stacked Bars */}
            {yScale === 'count' ? (
              <>
                <Bar
                  dataKey="funded"
                  name="Funded"
                  stackId="a"
                  fill={COLORS.funded}
                  radius={[0, 0, 0, 0]}
                />
                <Bar dataKey="paid" name="Paid" stackId="a" fill={COLORS.paid} />
                <Bar dataKey="defaulted" name="Defaulted" stackId="a" fill={COLORS.defaulted} />
                <Bar
                  dataKey="pending"
                  name="Pending"
                  stackId="a"
                  fill={COLORS.pending}
                  radius={[4, 4, 0, 0]}
                />
              </>
            ) : (
              // For Volume, we just show a single bar for now or we need to calculate volume per status
              // The requirement says "Stacked bars showing invoice distribution... Include status breakdown"
              // So I should calculate volume per status too in the aggregator.
              <>
                <Bar dataKey="volume_funded" name="Funded" stackId="a" fill={COLORS.funded} />
                <Bar dataKey="volume_paid" name="Paid" stackId="a" fill={COLORS.paid} />
                <Bar
                  dataKey="volume_defaulted"
                  name="Defaulted"
                  stackId="a"
                  fill={COLORS.defaulted}
                />
                <Bar
                  dataKey="volume_pending"
                  name="Pending"
                  stackId="a"
                  fill={COLORS.pending}
                  radius={[4, 4, 0, 0]}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
