import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { buildYieldTimeSeries, calcAvgWeeklyYieldPct } from '@/utils/yield-timeseries';
import type { Invoice } from '@/utils/soroban';

const LP = 'GLP0000000000000000000000000000000000000000000000000000';

// Pin "now" to a fixed timestamp so cutoff calculations are deterministic
const NOW_S = 1_750_000_000; // arbitrary fixed second

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_S * 1000);
});

afterEach(() => {
  vi.useRealTimers();
});

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: 1n,
    freelancer: 'GFR1',
    payer: 'GPAYER1',
    amount: 10_000_000n, // 10 USDC (6 decimals)
    due_date: BigInt(NOW_S + 86400),
    discount_rate: 500, // 5%
    status: 'Paid',
    funder: LP,
    funded_at: BigInt(NOW_S - 7 * 86400), // 7 days ago
    token: 'token-usdc',
    ...overrides,
  };
}

describe('buildYieldTimeSeries', () => {
  it('returns empty array when there are no paid invoices', () => {
    const result = buildYieldTimeSeries([], LP, 30);
    expect(result).toEqual([]);
  });

  it('excludes invoices outside the selected day range', () => {
    const old = makeInvoice({ funded_at: BigInt(NOW_S - 91 * 86400), id: 2n });
    const recent = makeInvoice({ funded_at: BigInt(NOW_S - 7 * 86400), id: 3n });
    const result = buildYieldTimeSeries([old, recent], LP, 30);
    expect(result).toHaveLength(1);
  });

  it('excludes invoices not funded by the LP address', () => {
    const other = makeInvoice({
      funder: 'GOTHER000000000000000000000000000000000000000000000000000',
    });
    const result = buildYieldTimeSeries([other], LP, 30);
    expect(result).toEqual([]);
  });

  it('excludes non-paid invoices', () => {
    const funded = makeInvoice({ status: 'Funded' });
    const result = buildYieldTimeSeries([funded], LP, 30);
    expect(result).toEqual([]);
  });

  it('groups invoices in the same week into one bucket', () => {
    const inv1 = makeInvoice({ id: 1n, funded_at: BigInt(NOW_S - 3 * 86400) });
    const inv2 = makeInvoice({ id: 2n, funded_at: BigInt(NOW_S - 4 * 86400) });
    const result = buildYieldTimeSeries([inv1, inv2], LP, 30);
    // Both fall in the same week bucket
    expect(result).toHaveLength(1);
    expect(result[0].USDC).toBeCloseTo(((10_000_000 * 500) / 10_000 / 1e6) * 2, 5);
  });

  it('accumulates cumulative yield across weeks', () => {
    const week1 = makeInvoice({ id: 1n, funded_at: BigInt(NOW_S - 14 * 86400) });
    const week2 = makeInvoice({ id: 2n, funded_at: BigInt(NOW_S - 3 * 86400) });
    const result = buildYieldTimeSeries([week1, week2], LP, 30);
    expect(result).toHaveLength(2);
    expect(result[1].cumulative).toBeGreaterThan(result[0].cumulative);
  });

  it('separates EURC and USDC into distinct series', () => {
    const usdc = makeInvoice({ id: 1n, token: 'token-usdc' });
    const eurc = makeInvoice({ id: 2n, token: 'token-eurc', funded_at: BigInt(NOW_S - 3 * 86400) });
    const result = buildYieldTimeSeries([usdc, eurc], LP, 30);
    const hasEurc = result.some((p) => p.EURC > 0);
    const hasUsdc = result.some((p) => p.USDC > 0);
    expect(hasEurc).toBe(true);
    expect(hasUsdc).toBe(true);
  });

  it('returns data points sorted chronologically', () => {
    const inv1 = makeInvoice({ id: 1n, funded_at: BigInt(NOW_S - 21 * 86400) });
    const inv2 = makeInvoice({ id: 2n, funded_at: BigInt(NOW_S - 7 * 86400) });
    const result = buildYieldTimeSeries([inv2, inv1], LP, 30);
    expect(result[0].isoDate <= result[1].isoDate).toBe(true);
  });
});

describe('calcAvgWeeklyYieldPct', () => {
  it('returns 0 when there are no paid invoices', () => {
    expect(calcAvgWeeklyYieldPct([], LP, 30)).toBe(0);
  });

  it('calculates correct average weekly yield percentage', () => {
    // 10 USDC at 5% discount = 0.5 USDC yield over 30 days (≈4.28 weeks)
    const inv = makeInvoice({});
    const result = calcAvgWeeklyYieldPct([inv], LP, 30);
    // (0.5 / 10) / (30/7) * 100 ≈ 1.1667%
    expect(result).toBeGreaterThan(0);
    expect(result).toBeCloseTo(1.1667, 3);
  });
});
