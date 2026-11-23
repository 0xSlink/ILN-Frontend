import { describe, expect, it } from 'vitest';
import { isMetricFresh, toWholeUnits, type MetricProvenance } from '../financial-metrics';

const provenance: MetricProvenance = {
  source: 'on-chain',
  asOf: '2026-01-01T00:00:00.000Z',
  unit: 'USDC',
  staleAfterMs: 60_000,
};

describe('financial metric provenance', () => {
  it('normalizes raw transaction units without changing token precision', () => {
    expect(toWholeUnits(123_456_789n, 7)).toBe(12.3456789);
    expect(toWholeUnits(500n, 2)).toBe(5);
  });

  it('rejects invalid decimal metadata', () => {
    expect(() => toWholeUnits(1n, -1)).toThrow(RangeError);
    expect(() => toWholeUnits(1n, 31)).toThrow(RangeError);
  });

  it('marks metrics stale after their declared freshness window', () => {
    const asOf = Date.parse(provenance.asOf);
    expect(isMetricFresh(provenance, asOf + 59_999)).toBe(true);
    expect(isMetricFresh(provenance, asOf + 60_001)).toBe(false);
  });

  it('rejects future timestamps instead of presenting them as fresh', () => {
    expect(isMetricFresh(provenance, Date.parse(provenance.asOf) - 1)).toBe(false);
  });
});
