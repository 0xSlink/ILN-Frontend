import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  calculatePerTokenMetrics,
  calculateWeeklyYieldPerToken,
  convertToUSD,
  getTotalYieldInUSD,
  getTotalFundedInUSD,
  calculateTokenAllocations,
  TESTNET_EXCHANGE_RATES,
  type TokenYieldMetrics,
} from '../per-token-yield';
import type { Invoice } from '../soroban';
import type { ApprovedToken } from '@/hooks/useApprovedTokens';

const USDC: ApprovedToken = {
  contractId: 'USDC_ID',
  symbol: 'USDC',
  decimals: 6,
  name: 'USD Coin',
  iconLabel: 'U',
  isAllowed: true,
} as ApprovedToken;

const EURC: ApprovedToken = {
  contractId: 'EURC_ID',
  symbol: 'EURC',
  decimals: 6,
  name: 'Euro Coin',
  iconLabel: 'E',
  isAllowed: true,
} as ApprovedToken;

const tokenMap = new Map([
  ['USDC_ID', USDC],
  ['EURC_ID', EURC],
]);

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1n,
    freelancer: 'GF',
    payer: 'GP',
    amount: 1_000_000n,
    discount_rate: 500,
    status: 'Funded',
    due_date: 0n,
    token: 'USDC_ID',
    ...overrides,
  } as Invoice;
}

describe('calculatePerTokenMetrics', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty array with no invoices', () => {
    expect(calculatePerTokenMetrics([], tokenMap, USDC)).toEqual([]);
  });

  it('skips invoices for unknown tokens', () => {
    const result = calculatePerTokenMetrics([invoice({ token: 'UNKNOWN_ID' })], tokenMap, USDC);
    expect(result).toEqual([]);
  });

  it('falls back to the default token when an invoice has no token', () => {
    const result = calculatePerTokenMetrics([invoice({ token: undefined })], tokenMap, USDC);
    expect(result[0].token.symbol).toBe('USDC');
  });

  it('separates paid yield from pending yield and computes yield percentage', () => {
    const result = calculatePerTokenMetrics(
      [
        invoice({ id: 1n, status: 'Paid', amount: 1_000_000n, discount_rate: 1000 }),
        invoice({ id: 2n, status: 'Funded', amount: 1_000_000n, discount_rate: 500 }),
        invoice({ id: 3n, status: 'Submitted' }), // ignored
      ],
      tokenMap,
      USDC
    );
    const usdcMetrics = result.find((m) => m.token.symbol === 'USDC')!;
    expect(usdcMetrics.invoiceCount).toBe(3);
    expect(usdcMetrics.paidCount).toBe(1);
    expect(usdcMetrics.totalFunded).toBe(2_000_000n);
    expect(usdcMetrics.totalYieldEarned).toBeGreaterThan(0n);
    expect(usdcMetrics.pendingYield).toBeGreaterThan(0n);
    expect(usdcMetrics.sparklineData).toHaveLength(7);
  });

  it('sorts tokens by total yield earned descending', () => {
    const result = calculatePerTokenMetrics(
      [
        invoice({ id: 1n, token: 'USDC_ID', status: 'Paid', amount: 100_000n, discount_rate: 100 }),
        invoice({
          id: 2n,
          token: 'EURC_ID',
          status: 'Paid',
          amount: 10_000_000n,
          discount_rate: 1000,
        }),
      ],
      tokenMap,
      USDC
    );
    expect(result[0].token.symbol).toBe('EURC');
  });
});

describe('calculateWeeklyYieldPerToken', () => {
  it('only includes Paid invoices with a funded_at timestamp', () => {
    const result = calculateWeeklyYieldPerToken(
      [invoice({ status: 'Funded', funded_at: 1700000000n })],
      tokenMap,
      USDC
    );
    expect(result).toEqual([]);
  });

  it('buckets paid invoices into weeks and sorts by token then week', () => {
    const result = calculateWeeklyYieldPerToken(
      [
        invoice({ id: 1n, token: 'USDC_ID', status: 'Paid', funded_at: 1700000000n }),
        invoice({ id: 2n, token: 'EURC_ID', status: 'Paid', funded_at: 1700000000n }),
      ],
      tokenMap,
      USDC
    );
    expect(result).toHaveLength(2);
    expect(result[0].token.symbol).toBe('EURC');
  });
});

describe('convertToUSD', () => {
  it('applies the default testnet exchange rate for the token symbol', () => {
    const usd = convertToUSD(1_000_000n, EURC);
    expect(usd).toBe(BigInt(Math.round(1 * TESTNET_EXCHANGE_RATES.EURC * 1_000_000)));
  });

  it('applies a custom rate when provided', () => {
    const usd = convertToUSD(1_000_000n, USDC, 2);
    expect(usd).toBe(2_000_000n);
  });

  it('defaults to a 1:1 rate for unrecognized symbols', () => {
    const otherToken = { ...USDC, symbol: 'XYZ' } as ApprovedToken;
    expect(convertToUSD(1_000_000n, otherToken)).toBe(1_000_000n);
  });
});

describe('getTotalYieldInUSD / getTotalFundedInUSD', () => {
  const metrics: TokenYieldMetrics[] = [
    {
      token: USDC,
      totalFunded: 1_000_000n,
      totalYieldEarned: 100_000n,
      pendingYield: 0n,
      yieldPercentage: 10,
      invoiceCount: 1,
      paidCount: 1,
    },
    {
      token: EURC,
      totalFunded: 1_000_000n,
      totalYieldEarned: 100_000n,
      pendingYield: 0n,
      yieldPercentage: 10,
      invoiceCount: 1,
      paidCount: 1,
    },
  ];

  it('sums native amounts when useUSD is false', () => {
    expect(getTotalYieldInUSD(metrics, false)).toBe(200_000n);
    expect(getTotalFundedInUSD(metrics, false)).toBe(2_000_000n);
  });

  it('converts each token to USD before summing when useUSD is true', () => {
    const totalYieldUsd = getTotalYieldInUSD(metrics, true);
    const expected = convertToUSD(100_000n, USDC) + convertToUSD(100_000n, EURC);
    expect(totalYieldUsd).toBe(expected);
  });
});

describe('calculateTokenAllocations', () => {
  it('computes USD-weighted percentages summing to ~100', () => {
    const metrics: TokenYieldMetrics[] = [
      {
        token: USDC,
        totalFunded: 1_000_000n,
        totalYieldEarned: 0n,
        pendingYield: 0n,
        yieldPercentage: 0,
        invoiceCount: 1,
        paidCount: 0,
      },
      {
        token: EURC,
        totalFunded: 1_000_000n,
        totalYieldEarned: 0n,
        pendingYield: 0n,
        yieldPercentage: 0,
        invoiceCount: 1,
        paidCount: 0,
      },
    ];
    const allocations = calculateTokenAllocations(metrics);
    const totalPct = allocations.reduce((sum, a) => sum + a.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 5);
  });

  it('returns zero percentages when there is no funded volume', () => {
    const allocations = calculateTokenAllocations([
      {
        token: USDC,
        totalFunded: 0n,
        totalYieldEarned: 0n,
        pendingYield: 0n,
        yieldPercentage: 0,
        invoiceCount: 0,
        paidCount: 0,
      },
    ]);
    expect(allocations[0].percentage).toBe(0);
  });
});
