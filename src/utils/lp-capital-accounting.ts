import type { Invoice } from './soroban';
import { evaluateSourceFreshness } from '@/hooks/queries/defaultConfig';

/**
 * Shared LP capital and maturity accounting (#1263, #1264).
 *
 * Scope: presentation-layer accounting over the invoice list returned by the
 * canonical `useInvoices` React Query hook. It does not read balances, submit
 * transactions, or invent values for data that the query did not provide.
 *
 * Verified findings / assumptions:
 * - Outstanding funded capital is the principal in `Funded` and `Disputed`
 *   invoices. `Paid` principal is settled; `Pending`, `Defaulted` and
 *   `Cancelled` invoices are neither committed nor settled here.
 * - `amount_paid` is a verified partial-repayment amount when present. When it
 *   is absent the outstanding obligation is the full principal; no repayment
 *   is inferred from status alone.
 * - A due date is usable only when it is a finite, positive Unix-second value.
 *   Missing/zero due dates go to an explicit `unknown` bucket; they are never
 *   silently treated as overdue or as a far-future maturity.
 * - All amounts are native token units from the same invoice read. Sums are
 *   deliberately NOT FX-converted across tokens; the UI must label them as
 *   native-unit totals.
 */

export const OUTSTANDING_FUNDED_STATUSES = ['Funded', 'Disputed'] as const;
const SETTLED_STATUS = 'Paid';
const DAY_MS = 24 * 60 * 60 * 1000;

/** How long an invoice read may remain labelled verified in LP summary panels. */
export const LP_DATA_FRESHNESS_MAX_AGE_MS = 60_000;

/** Clock skew tolerated before a future `dataUpdatedAt` is treated as stale. */
const CLOCK_SKEW_MS = 60_000;

export type LPDataStatus = 'loading' | 'unavailable' | 'stale' | 'verified';

export interface LPDataFreshnessInput {
  isLoading?: boolean;
  isError?: boolean;
  dataUpdatedAt?: number;
  now?: number;
}

/**
 * Distinguishes loading, indexer/RPC unavailable, stale last-known values, and
 * verified data. A failed read with cached rows is `unavailable` (the rows are
 * labelled last-known), while an old but successful read is `stale`.
 */
export function deriveLPDataStatus({
  isLoading = false,
  isError = false,
  dataUpdatedAt,
  now = Date.now(),
}: LPDataFreshnessInput): LPDataStatus {
  if (isError) return 'unavailable';
  if (isLoading && !dataUpdatedAt) return 'loading';
  if (
    dataUpdatedAt === undefined ||
    !Number.isFinite(dataUpdatedAt) ||
    dataUpdatedAt <= 0 ||
    dataUpdatedAt > now + CLOCK_SKEW_MS
  ) {
    return dataUpdatedAt ? 'stale' : 'unavailable';
  }

  const freshness = evaluateSourceFreshness(
    dataUpdatedAt,
    LP_DATA_FRESHNESS_MAX_AGE_MS / 1000,
    now
  );
  return freshness === 'fresh' ? 'verified' : 'stale';
}

export function hasUsableDueDate(invoice: Invoice): boolean {
  const seconds = Number(invoice.due_date);
  return Number.isFinite(seconds) && seconds > 0;
}

/** Remaining principal on an invoice, clamped to zero after full repayment. */
export function remainingPrincipal(invoice: Invoice): bigint {
  const paid = invoice.amount_paid && invoice.amount_paid > 0n ? invoice.amount_paid : 0n;
  return paid >= invoice.amount ? 0n : invoice.amount - paid;
}

function isOutstandingFunded(invoice: Invoice): boolean {
  return (OUTSTANDING_FUNDED_STATUSES as readonly string[]).includes(invoice.status);
}

export interface LPCapitalBreakdown {
  /** Principal currently committed to Funded/Disputed positions. */
  committedCapital: bigint;
  /** Unrepaid portion of committed capital (outstanding LP obligation). */
  outstandingObligations: bigint;
  /** Principal of Paid positions. */
  settledCapital: bigint;
  committedPositions: number;
  settledPositions: number;
}

/**
 * Separates committed, outstanding and settled capital using mutually
 * exclusive status sets so no invoice is counted twice.
 */
export function calculateCapitalBreakdown(invoices: Invoice[]): LPCapitalBreakdown {
  let committedCapital = 0n;
  let outstandingObligations = 0n;
  let settledCapital = 0n;
  let committedPositions = 0;
  let settledPositions = 0;

  invoices.forEach((invoice) => {
    if (isOutstandingFunded(invoice)) {
      committedCapital += invoice.amount;
      outstandingObligations += remainingPrincipal(invoice);
      committedPositions += 1;
    } else if (invoice.status === SETTLED_STATUS) {
      settledCapital += invoice.amount;
      settledPositions += 1;
    }
  });

  return {
    committedCapital,
    outstandingObligations,
    settledCapital,
    committedPositions,
    settledPositions,
  };
}

export type MaturityBucketId =
  | 'overdue'
  | 'within7d'
  | 'within30d'
  | 'within90d'
  | 'later'
  | 'unknown';

export interface MaturityBucket {
  id: MaturityBucketId;
  label: string;
  positionCount: number;
  outstandingPrincipal: bigint;
}

export interface LPMaturityExposure {
  buckets: MaturityBucket[];
  totalOutstanding: bigint;
  totalPositions: number;
  missingDueDateCount: number;
}

const BUCKET_LABELS: Record<MaturityBucketId, string> = {
  overdue: 'Overdue',
  within7d: 'Due within 7 days',
  within30d: '8–30 days',
  within90d: '31–90 days',
  later: 'More than 90 days',
  unknown: 'Missing due date',
};

export const MATURITY_BUCKET_ORDER: readonly MaturityBucketId[] = [
  'overdue',
  'within7d',
  'within30d',
  'within90d',
  'later',
  'unknown',
];

/** Maps a verified Unix-second due date to a fixed maturity window. */
export function maturityBucketForDueDate(dueDateSeconds: number, nowMs: number): MaturityBucketId {
  if (!Number.isFinite(dueDateSeconds) || dueDateSeconds <= 0) return 'unknown';
  const deltaMs = dueDateSeconds * 1000 - nowMs;
  if (deltaMs <= 0) return 'overdue';
  if (deltaMs <= 7 * DAY_MS) return 'within7d';
  if (deltaMs <= 30 * DAY_MS) return 'within30d';
  if (deltaMs <= 90 * DAY_MS) return 'within90d';
  return 'later';
}

/**
 * Groups outstanding funded positions by due date. Missing/invalid due dates
 * are reported separately and never folded into a time bucket. Every bucket is
 * present in the result, including empty ones, for a stable view.
 */
export function groupMaturityExposure(invoices: Invoice[], nowMs = Date.now()): LPMaturityExposure {
  const byId = new Map<MaturityBucketId, MaturityBucket>(
    MATURITY_BUCKET_ORDER.map((id) => [
      id,
      { id, label: BUCKET_LABELS[id], positionCount: 0, outstandingPrincipal: 0n },
    ])
  );

  let totalOutstanding = 0n;
  let totalPositions = 0;
  let missingDueDateCount = 0;

  invoices.forEach((invoice) => {
    if (!isOutstandingFunded(invoice)) return;

    const dueDateSeconds = Number(invoice.due_date);
    const bucketId = hasUsableDueDate(invoice)
      ? maturityBucketForDueDate(dueDateSeconds, nowMs)
      : 'unknown';
    const outstanding = remainingPrincipal(invoice);
    const bucket = byId.get(bucketId)!;

    bucket.positionCount += 1;
    bucket.outstandingPrincipal += outstanding;
    totalOutstanding += outstanding;
    totalPositions += 1;
    if (bucketId === 'unknown') missingDueDateCount += 1;
  });

  return {
    buckets: MATURITY_BUCKET_ORDER.map((id) => byId.get(id)!),
    totalOutstanding,
    totalPositions,
    missingDueDateCount,
  };
}
