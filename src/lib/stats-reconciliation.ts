/**
 * Same-ledger / same-as-of reconciliation utilities for comparing displayed
 * frontend totals against authoritative on-chain RPC and indexer snapshots (#1353).
 */

export interface SnapshotPoint {
  /** Stellar ledger sequence number at which the snapshot was captured, if known. */
  ledger: number | null;
  /** ISO-8601 UTC timestamp at which the snapshot was captured, if known. */
  asOf: string | null;
}

export interface ProtocolTotalsSnapshot extends SnapshotPoint {
  totalInvoices: number;
  totalFunded: number;
  totalPaid: number;
  totalVolumeUsd: number;
}

export interface ReconciliationOptions {
  /** Maximum allowed ledger difference between two compared snapshots (default: 0 = exact same ledger). */
  maxLedgerDelta?: number;
  /** Maximum allowed wall-clock skew in ms when comparing by `asOf` without ledger numbers (default: 60_000). */
  maxAsOfSkewMs?: number;
  /** Maximum allowed floating-point tolerance for USD volume comparisons (default: 0.01). */
  volumeToleranceUsd?: number;
}

export type ReconciliationDiscrepancyCode =
  | 'missing-reference-point'
  | 'ledger-mismatch'
  | 'as-of-skew'
  | 'invoice-count-mismatch'
  | 'funded-count-mismatch'
  | 'paid-count-mismatch'
  | 'volume-usd-mismatch';

export interface ReconciliationDiscrepancy {
  code: ReconciliationDiscrepancyCode;
  field: string;
  expected: number | string | null;
  actual: number | string | null;
  message: string;
}

export interface ReconciliationResult {
  ok: boolean;
  comparedAt: {
    referenceLedger: number | null;
    displayedLedger: number | null;
    ledgerDelta: number | null;
    asOfSkewMs: number | null;
  };
  discrepancies: ReconciliationDiscrepancy[];
}

/**
 * Compare displayed UI totals against an authoritative on-chain/indexer
 * reference snapshot, enforcing that both snapshots were captured at the same
 * ledger (or within the configured `asOf` window when ledgers are unavailable).
 */
export function reconcileProtocolTotals(
  reference: ProtocolTotalsSnapshot,
  displayed: ProtocolTotalsSnapshot,
  options: ReconciliationOptions = {}
): ReconciliationResult {
  const maxLedgerDelta = options.maxLedgerDelta ?? 0;
  const maxAsOfSkewMs = options.maxAsOfSkewMs ?? 60_000;
  const volumeToleranceUsd = options.volumeToleranceUsd ?? 0.01;

  const discrepancies: ReconciliationDiscrepancy[] = [];

  const hasLedgers =
    typeof reference.ledger === 'number' &&
    Number.isSafeInteger(reference.ledger) &&
    typeof displayed.ledger === 'number' &&
    Number.isSafeInteger(displayed.ledger);

  const ledgerDelta = hasLedgers ? Math.abs(reference.ledger! - displayed.ledger!) : null;

  const refMs = reference.asOf ? Date.parse(reference.asOf) : Number.NaN;
  const dispMs = displayed.asOf ? Date.parse(displayed.asOf) : Number.NaN;
  const hasAsOf = Number.isFinite(refMs) && Number.isFinite(dispMs);
  const asOfSkewMs = hasAsOf ? Math.abs(refMs - dispMs) : null;

  if (!hasLedgers && !hasAsOf) {
    discrepancies.push({
      code: 'missing-reference-point',
      field: 'ledger/asOf',
      expected: 'valid ledger or ISO timestamp on both snapshots',
      actual: null,
      message: 'Cannot reconcile snapshots without a shared ledger sequence or valid asOf timestamp.',
    });
  } else if (hasLedgers && ledgerDelta! > maxLedgerDelta) {
    discrepancies.push({
      code: 'ledger-mismatch',
      field: 'ledger',
      expected: reference.ledger,
      actual: displayed.ledger,
      message: `Snapshot ledger mismatch: reference ledger #${reference.ledger} vs displayed ledger #${displayed.ledger} (delta ${ledgerDelta}, max ${maxLedgerDelta}).`,
    });
  } else if (!hasLedgers && hasAsOf && asOfSkewMs! > maxAsOfSkewMs) {
    discrepancies.push({
      code: 'as-of-skew',
      field: 'asOf',
      expected: reference.asOf,
      actual: displayed.asOf,
      message: `Snapshot asOf skew ${asOfSkewMs}ms exceeds allowed ${maxAsOfSkewMs}ms.`,
    });
  }

  if (displayed.totalInvoices !== reference.totalInvoices) {
    discrepancies.push({
      code: 'invoice-count-mismatch',
      field: 'totalInvoices',
      expected: reference.totalInvoices,
      actual: displayed.totalInvoices,
      message: `Total invoices mismatch: expected ${reference.totalInvoices}, displayed ${displayed.totalInvoices}.`,
    });
  }

  if (displayed.totalFunded !== reference.totalFunded) {
    discrepancies.push({
      code: 'funded-count-mismatch',
      field: 'totalFunded',
      expected: reference.totalFunded,
      actual: displayed.totalFunded,
      message: `Total funded mismatch: expected ${reference.totalFunded}, displayed ${displayed.totalFunded}.`,
    });
  }

  if (displayed.totalPaid !== reference.totalPaid) {
    discrepancies.push({
      code: 'paid-count-mismatch',
      field: 'totalPaid',
      expected: reference.totalPaid,
      actual: displayed.totalPaid,
      message: `Total paid mismatch: expected ${reference.totalPaid}, displayed ${displayed.totalPaid}.`,
    });
  }

  const volumeDiff = Math.abs(displayed.totalVolumeUsd - reference.totalVolumeUsd);
  if (!Number.isFinite(volumeDiff) || volumeDiff > volumeToleranceUsd) {
    discrepancies.push({
      code: 'volume-usd-mismatch',
      field: 'totalVolumeUsd',
      expected: reference.totalVolumeUsd,
      actual: displayed.totalVolumeUsd,
      message: `Total USD volume mismatch: expected ${reference.totalVolumeUsd}, displayed ${displayed.totalVolumeUsd} (diff ${volumeDiff}).`,
    });
  }

  return {
    ok: discrepancies.length === 0,
    comparedAt: {
      referenceLedger: reference.ledger,
      displayedLedger: displayed.ledger,
      ledgerDelta,
      asOfSkewMs,
    },
    discrepancies,
  };
}
