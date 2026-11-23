import { type MonthlyDefaultBucket } from '@/lib/indexerClient';

// Re-exported so existing importers keep working after the schemas moved (#1105).
export type { MonthlyDefaultBucket };

export interface MonthlyDefaultWithMA extends MonthlyDefaultBucket {
  movingAverage: number;
}

/** Trailing observation window queried by DefaultRateChart (`period=12m`). */
export const DEFAULT_RATE_OBSERVATION_WINDOW_MONTHS = 12;

/**
 * Minimum funded invoice count across the observation window required before
 * presenting the default rate without an insufficient-history warning.
 */
export const DEFAULT_RATE_MIN_FUNDED_SAMPLE = 5;

/**
 * Calendar-month lag from the current UTC month at or above which the latest
 * observed bucket is treated as stale payer history.
 */
export const DEFAULT_RATE_STALE_MONTHS_THRESHOLD = 2;

export interface DefaultRateHistoryAssessment {
  /** Total defaulted invoice count across all buckets in the observation window. */
  totalDefaulted: number;
  /** Total funded invoice count across all buckets in the observation window (denominator). */
  totalFunded: number;
  /** Count-weighted default rate (%) over the observation window, or null when totalFunded === 0. */
  windowDefaultRate: number | null;
  /** Latest bucket default rate (%), or null when no buckets exist or latest bucket has funded === 0. */
  currentDefaultRate: number | null;
  /** Number of monthly buckets in the window with zero funded invoices. */
  zeroDenominatorBuckets: number;
  /** True when the observation window has no buckets or fewer than DEFAULT_RATE_MIN_FUNDED_SAMPLE funded invoices. */
  insufficientHistory: boolean;
  /** True when the latest bucket date lags `now` by at least DEFAULT_RATE_STALE_MONTHS_THRESHOLD months. */
  staleHistory: boolean;
  /** Latest bucket `YYYY-MM` identifier, or null when data is empty. */
  latestBucketDate: string | null;
  /** Calendar-month lag between `latestBucketDate` and `now`, or null if unavailable/unparseable. */
  staleMonthsLag: number | null;
}

/**
 * Parse a `YYYY-MM` bucket date string into UTC calendar month lag relative to `now`.
 * Returns `null` for malformed strings so invalid dates do not fabricate freshness.
 */
export function parseBucketMonthsLag(bucketDate: string, now: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(bucketDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  return (currentYear - year) * 12 + (currentMonth - month);
}

/**
 * Audit a default-rate series for denominator validity, sample sufficiency,
 * and payer-history freshness (#1277).
 */
export function assessDefaultRateHistory(
  data: MonthlyDefaultBucket[],
  now: Date = new Date()
): DefaultRateHistoryAssessment {
  if (data.length === 0) {
    return {
      totalDefaulted: 0,
      totalFunded: 0,
      windowDefaultRate: null,
      currentDefaultRate: null,
      zeroDenominatorBuckets: 0,
      insufficientHistory: true,
      staleHistory: false,
      latestBucketDate: null,
      staleMonthsLag: null,
    };
  }

  let totalDefaulted = 0;
  let totalFunded = 0;
  let zeroDenominatorBuckets = 0;

  for (const bucket of data) {
    totalDefaulted += bucket.defaulted;
    totalFunded += bucket.funded;
    if (bucket.funded <= 0) {
      zeroDenominatorBuckets += 1;
    }
  }

  const latest = data[data.length - 1];
  const windowDefaultRate = totalFunded > 0 ? (totalDefaulted / totalFunded) * 100 : null;
  const currentDefaultRate = latest.funded > 0 ? latest.defaultRate : null;
  const staleMonthsLag = parseBucketMonthsLag(latest.date, now);
  const staleHistory =
    staleMonthsLag !== null && staleMonthsLag >= DEFAULT_RATE_STALE_MONTHS_THRESHOLD;
  const insufficientHistory =
    totalFunded < DEFAULT_RATE_MIN_FUNDED_SAMPLE || latest.funded <= 0;

  return {
    totalDefaulted,
    totalFunded,
    windowDefaultRate,
    currentDefaultRate,
    zeroDenominatorBuckets,
    insufficientHistory,
    staleHistory,
    latestBucketDate: latest.date,
    staleMonthsLag,
  };
}

export function calculateMovingAverage(
  data: MonthlyDefaultBucket[],
  windowSize: number = 1
): MonthlyDefaultWithMA[] {
  if (data.length === 0) return [];

  return data.map((bucket, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = data.slice(start, index + 1);
    const avg = slice.reduce((sum, b) => sum + b.defaultRate, 0) / slice.length;

    return {
      ...bucket,
      movingAverage: Math.round(avg * 100) / 100,
    };
  });
}
