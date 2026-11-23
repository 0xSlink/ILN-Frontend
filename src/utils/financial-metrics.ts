export type MetricSource = 'on-chain' | 'indexer' | 'derived' | 'fallback';

export interface MetricProvenance {
  source: MetricSource;
  asOf: string;
  unit: string;
  staleAfterMs: number;
}

export function isMetricFresh(provenance: MetricProvenance, now = Date.now()): boolean {
  const asOf = Date.parse(provenance.asOf);
  return Number.isFinite(asOf) && now - asOf >= 0 && now - asOf <= provenance.staleAfterMs;
}

export function toWholeUnits(raw: bigint | number, decimals: number): number {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
    throw new RangeError('decimals must be an integer between 0 and 30');
  }
  return Number(raw) / 10 ** decimals;
}
