import { describe, it, expect } from 'vitest';
import { percentile, summarize, timed } from '../scripts/measure-governance-latency.mjs';

/**
 * The governance latency figures recorded in docs/slos.md (#960) come from
 * scripts/measure-governance-latency.mjs. These tests pin the statistics it
 * reports so the published p50/p95 numbers mean what the doc says they mean.
 */
describe('measure-governance-latency helpers (#960)', () => {
  it('computes linearly interpolated percentiles', () => {
    const values = [100, 200, 300, 400, 500];
    expect(percentile(values, 50)).toBe(300);
    expect(percentile(values, 95)).toBeCloseTo(480);
    expect(percentile(values, 100)).toBe(500);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 50)).toBeNull();
  });

  it('is independent of sample order', () => {
    expect(percentile([500, 100, 400, 200, 300], 50)).toBe(300);
  });

  it('summarizes only successful samples and counts errors', () => {
    const summary = summarize([
      { ok: true, ms: 100.4 },
      { ok: true, ms: 300.6 },
      { ok: false, ms: 9000 },
      { ok: true, ms: 200 },
    ]);
    expect(summary).toEqual({ n: 4, errors: 1, p50: 200, p95: 291, max: 301 });
  });

  it('reports null statistics when every sample failed', () => {
    expect(summarize([{ ok: false, ms: 5 }])).toEqual({
      n: 1,
      errors: 1,
      p50: null,
      p95: null,
      max: null,
    });
  });

  it('times resolved and rejected calls without throwing', async () => {
    const ok = await timed(async () => 'value');
    expect(ok).toMatchObject({ ok: true, value: 'value' });
    expect(ok.ms).toBeGreaterThanOrEqual(0);

    const failed = await timed(async () => {
      throw new Error('rpc down');
    });
    expect(failed).toMatchObject({ ok: false, error: 'rpc down' });
  });
});
