import { describe, expect, it } from 'vitest';
import {
  reconcileProtocolTotals,
  type ProtocolTotalsSnapshot,
} from '@/lib/stats-reconciliation';

const baseReference: ProtocolTotalsSnapshot = {
  ledger: 550_000,
  asOf: '2026-07-15T12:00:00.000Z',
  totalInvoices: 42,
  totalFunded: 30,
  totalPaid: 22,
  totalVolumeUsd: 185_000.25,
};

describe('reconcileProtocolTotals', () => {
  it('succeeds when displayed and reference totals match at the exact same ledger', () => {
    const result = reconcileProtocolTotals(baseReference, { ...baseReference });
    expect(result.ok).toBe(true);
    expect(result.discrepancies).toEqual([]);
    expect(result.comparedAt.ledgerDelta).toBe(0);
  });

  it('rejects snapshots captured at different ledgers by default', () => {
    const result = reconcileProtocolTotals(baseReference, {
      ...baseReference,
      ledger: 550_003,
    });
    expect(result.ok).toBe(false);
    expect(result.comparedAt.ledgerDelta).toBe(3);
    expect(result.discrepancies.map((d) => d.code)).toContain('ledger-mismatch');
  });

  it('allows bounded ledger delta when explicitly configured', () => {
    const result = reconcileProtocolTotals(
      baseReference,
      { ...baseReference, ledger: 550_001 },
      { maxLedgerDelta: 1 }
    );
    expect(result.ok).toBe(true);
  });

  it('falls back to asOf alignment when ledger numbers are absent and flags skew', () => {
    const refNoLedger: ProtocolTotalsSnapshot = { ...baseReference, ledger: null };
    const dispWithinSkew: ProtocolTotalsSnapshot = {
      ...baseReference,
      ledger: null,
      asOf: '2026-07-15T12:00:30.000Z',
    };
    expect(reconcileProtocolTotals(refNoLedger, dispWithinSkew).ok).toBe(true);

    const dispSkewed: ProtocolTotalsSnapshot = {
      ...baseReference,
      ledger: null,
      asOf: '2026-07-15T12:05:00.000Z',
    };
    const skewedResult = reconcileProtocolTotals(refNoLedger, dispSkewed);
    expect(skewedResult.ok).toBe(false);
    expect(skewedResult.discrepancies.map((d) => d.code)).toContain('as-of-skew');
  });

  it('rejects comparison when neither ledger nor valid asOf is provided', () => {
    const result = reconcileProtocolTotals(
      { ...baseReference, ledger: null, asOf: null },
      { ...baseReference, ledger: null, asOf: null }
    );
    expect(result.ok).toBe(false);
    expect(result.discrepancies.map((d) => d.code)).toContain('missing-reference-point');
  });

  it('detects invoice count, funded count, paid count, and USD volume drift', () => {
    const result = reconcileProtocolTotals(baseReference, {
      ...baseReference,
      totalInvoices: 41,
      totalFunded: 29,
      totalPaid: 21,
      totalVolumeUsd: 184_990.0,
    });
    expect(result.ok).toBe(false);
    expect(result.discrepancies.map((d) => d.code)).toEqual([
      'invoice-count-mismatch',
      'funded-count-mismatch',
      'paid-count-mismatch',
      'volume-usd-mismatch',
    ]);
  });

  it('accepts sub-cent floating-point volume differences within tolerance', () => {
    const result = reconcileProtocolTotals(baseReference, {
      ...baseReference,
      totalVolumeUsd: 185_000.254,
    });
    expect(result.ok).toBe(true);
  });
});
