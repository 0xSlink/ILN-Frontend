import type { ParsedContractEvent } from '@/lib/contract-events';

export const DISPUTE_RATE_TOOLTIP =
  'Dispute rate is disputed invoices divided by funded invoices (InvoiceDisputed ÷ InvoiceFunded contract events) over the period shown.';

export type DisputeRateColor = 'green' | 'amber' | 'red';

export interface DisputeRateDayPoint {
  date: string;
  label: string;
  fundedCount: number;
  disputedCount: number;
  ratePercent: number;
}

export interface DisputeRateMetrics {
  rate30dPercent: number;
  funded30d: number;
  disputed30d: number;
  dailyTrend90d: DisputeRateDayPoint[];
}

const MS_PER_DAY = 86_400_000;

export function getDisputeRateColor(ratePercent: number): DisputeRateColor {
  if (ratePercent < 1) return 'green';
  if (ratePercent <= 5) return 'amber';
  return 'red';
}

export function getDisputeRateColorClasses(color: DisputeRateColor): {
  value: string;
  border: string;
  sparkline: string;
} {
  switch (color) {
    case 'green':
      return {
        value: 'text-green-700 dark:text-green-400',
        border: 'border-green-200/60 dark:border-green-800/60',
        sparkline: '#16a34a',
      };
    case 'amber':
      return {
        value: 'text-amber-800 dark:text-amber-400',
        border: 'border-amber-200/60 dark:border-amber-800/60',
        sparkline: '#d97706',
      };
    case 'red':
      return {
        value: 'text-red-700 dark:text-red-400',
        border: 'border-red-200/60 dark:border-red-800/60',
        sparkline: '#dc2626',
      };
  }
}

function eventTimestampMs(event: ParsedContractEvent): number | null {
  if (!event.createdAt) return null;
  const ts = Date.parse(event.createdAt);
  return Number.isFinite(ts) ? ts : null;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Compute 30-day dispute rate and 90-day daily trend from contract events. */
export function computeDisputeRateMetrics(
  events: ParsedContractEvent[],
  nowMs = Date.now()
): DisputeRateMetrics {
  const cutoff90 = nowMs - 90 * MS_PER_DAY;
  const cutoff30 = nowMs - 30 * MS_PER_DAY;

  const buckets = new Map<string, { funded: number; disputed: number }>();
  for (let i = 89; i >= 0; i -= 1) {
    const d = new Date(nowMs - i * MS_PER_DAY);
    const dateStr = d.toISOString().slice(0, 10);
    buckets.set(dateStr, { funded: 0, disputed: 0 });
  }

  let funded30 = 0;
  let disputed30 = 0;

  for (const event of events) {
    const ts = eventTimestampMs(event);
    if (ts === null || ts < cutoff90) continue;

    const dateStr = new Date(ts).toISOString().slice(0, 10);
    const bucket = buckets.get(dateStr);
    if (!bucket) continue;

    if (event.type === 'InvoiceFunded') {
      bucket.funded += 1;
      if (ts >= cutoff30) funded30 += 1;
    } else if (event.type === 'InvoiceDisputed') {
      bucket.disputed += 1;
      if (ts >= cutoff30) disputed30 += 1;
    }
  }

  const dailyTrend90d: DisputeRateDayPoint[] = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      label: formatDayLabel(date),
      fundedCount: counts.funded,
      disputedCount: counts.disputed,
      ratePercent: counts.funded > 0 ? (counts.disputed / counts.funded) * 100 : 0,
    }));

  const rate30dPercent = funded30 > 0 ? (disputed30 / funded30) * 100 : 0;

  return {
    rate30dPercent,
    funded30d: funded30,
    disputed30d: disputed30,
    dailyTrend90d,
  };
}

export function formatDisputeRatePercent(ratePercent: number): string {
  return `${ratePercent.toFixed(2)}%`;
}
