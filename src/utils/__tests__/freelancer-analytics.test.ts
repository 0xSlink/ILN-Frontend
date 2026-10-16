import { describe, expect, it } from 'vitest';
import {
  calculateFreelancerMetrics,
  getMonthlyInvoiceData,
  getDiscountOverTimeData,
  getPayerReliability,
  getOutcomeBreakdown,
} from '../freelancer-analytics';
import type { Invoice } from '../soroban';

const FREELANCER = 'GFREELANCER';
const OTHER = 'GOTHER';

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1n,
    freelancer: FREELANCER,
    payer: 'GPAYER',
    amount: 1_000_000n,
    discount_rate: 500,
    status: 'Submitted',
    due_date: 0n,
    ...overrides,
  } as Invoice;
}

describe('calculateFreelancerMetrics', () => {
  it('returns zeroed metrics when the freelancer has no invoices', () => {
    expect(calculateFreelancerMetrics([], FREELANCER)).toEqual({
      totalInvoiced: 0n,
      totalLiquidityReceived: 0n,
      totalDiscountCost: 0n,
      avgDiscountRate: 0,
      fundedRate: 0,
      avgTimeToFunding: null,
    });
  });

  it('ignores invoices belonging to other freelancers', () => {
    const metrics = calculateFreelancerMetrics(
      [invoice({ freelancer: OTHER, amount: 5_000_000n })],
      FREELANCER
    );
    expect(metrics.totalInvoiced).toBe(0n);
  });

  it('aggregates invoiced amount, discount cost, and funded rate', () => {
    const invoices = [
      invoice({ id: 1n, amount: 1_000_000n, discount_rate: 500, status: 'Funded' }),
      invoice({ id: 2n, amount: 1_000_000n, discount_rate: 300, status: 'Submitted' }),
    ];
    const metrics = calculateFreelancerMetrics(invoices, FREELANCER);

    expect(metrics.totalInvoiced).toBe(2_000_000n);
    expect(metrics.totalDiscountCost).toBe(50_000n + 30_000n);
    expect(metrics.totalLiquidityReceived).toBe(2_000_000n - 80_000n);
    expect(metrics.fundedRate).toBe(50);
    expect(metrics.avgDiscountRate).toBeCloseTo(4, 5);
  });

  it('counts Paid invoices as funded and computes average time-to-funding in hours', () => {
    const dueDate = 1000;
    const fundedAt = dueDate + 3600; // due_date used as submission proxy; +1h
    const invoices = [
      invoice({
        id: 1n,
        status: 'Paid',
        due_date: BigInt(dueDate),
        funded_at: BigInt(fundedAt),
      }),
    ];
    const metrics = calculateFreelancerMetrics(invoices, FREELANCER);
    expect(metrics.fundedRate).toBe(100);
    expect(metrics.avgTimeToFunding).toBeCloseTo(1, 5);
  });

  it('skips negative time-to-funding samples (funded before the "submission" proxy)', () => {
    const invoices = [
      invoice({
        id: 1n,
        status: 'Paid',
        due_date: 5000n,
        funded_at: 1000n, // funded_at before due_date -> negative delta, excluded
      }),
    ];
    const metrics = calculateFreelancerMetrics(invoices, FREELANCER);
    expect(metrics.avgTimeToFunding).toBeNull();
  });
});

describe('getMonthlyInvoiceData', () => {
  it('returns 12 months of buckets even with no invoices', () => {
    const data = getMonthlyInvoiceData([], FREELANCER);
    expect(data).toHaveLength(12);
    expect(data.every((d) => d.submitted === 0 && d.funded === 0)).toBe(true);
  });

  it('buckets invoices into the current month and counts funded ones', () => {
    const now = Math.floor(Date.now() / 1000);
    const data = getMonthlyInvoiceData(
      [
        invoice({ due_date: BigInt(now), status: 'Funded' }),
        invoice({ due_date: BigInt(now), status: 'Submitted' }),
      ],
      FREELANCER
    );
    const currentMonth = data[data.length - 1];
    expect(currentMonth.submitted).toBe(2);
    expect(currentMonth.funded).toBe(1);
  });
});

describe('getDiscountOverTimeData', () => {
  it('only includes Paid invoices with a funded_at timestamp', () => {
    const data = getDiscountOverTimeData(
      [
        invoice({ status: 'Paid', funded_at: undefined }),
        invoice({ status: 'Submitted', funded_at: 1700000000n }),
      ],
      FREELANCER
    );
    expect(data).toEqual([]);
  });

  it('sums discount cost per day and sorts chronologically', () => {
    const day1 = new Date(2026, 0, 1).getTime() / 1000;
    const day2 = new Date(2026, 0, 5).getTime() / 1000;
    const data = getDiscountOverTimeData(
      [
        invoice({
          id: 1n,
          status: 'Paid',
          funded_at: BigInt(Math.floor(day2)),
          amount: 2_000_000n,
        }),
        invoice({
          id: 2n,
          status: 'Paid',
          funded_at: BigInt(Math.floor(day1)),
          amount: 1_000_000n,
        }),
      ],
      FREELANCER
    );
    expect(data).toHaveLength(2);
    expect(new Date(data[0].date + ', 2026').getTime()).toBeLessThanOrEqual(
      new Date(data[1].date + ', 2026').getTime()
    );
  });
});

describe('getPayerReliability', () => {
  it('groups by payer and computes on-time rate and average settlement days', () => {
    const dueDate = 1000;
    const data = getPayerReliability(
      [
        invoice({
          id: 1n,
          payer: 'GPAYER1',
          status: 'Paid',
          due_date: BigInt(dueDate),
          funded_at: BigInt(dueDate - 86400), // paid 1 day early -> on time
          amount: 500_000n,
        }),
        invoice({
          id: 2n,
          payer: 'GPAYER1',
          status: 'Paid',
          due_date: BigInt(dueDate),
          funded_at: BigInt(dueDate + 86400 * 2), // paid 2 days late
          amount: 500_000n,
        }),
      ],
      FREELANCER
    );

    const payer = data.find((p) => p.payer === 'GPAYER1')!;
    expect(payer.totalInvoices).toBe(2);
    expect(payer.onTimeRate).toBe(50);
    expect(payer.avgSettlementDays).toBeCloseTo(0.5, 5);
    expect(payer.fundedAmount).toBe(1_000_000n);
  });

  it('reports zero rates for a payer with no settled invoices', () => {
    const data = getPayerReliability(
      [invoice({ payer: 'GPAYER2', status: 'Submitted' })],
      FREELANCER
    );
    expect(data[0].onTimeRate).toBe(0);
    expect(data[0].avgSettlementDays).toBe(0);
  });
});

describe('getOutcomeBreakdown', () => {
  it('counts Paid invoices as both Funded and Paid', () => {
    const breakdown = getOutcomeBreakdown(
      [
        invoice({ id: 1n, status: 'Funded' }),
        invoice({ id: 2n, status: 'Paid' }),
        invoice({ id: 3n, status: 'Defaulted' }),
        invoice({ id: 4n, status: 'Submitted' }),
      ],
      FREELANCER
    );
    expect(breakdown).toEqual([
      { name: 'Funded', value: 2 },
      { name: 'Paid', value: 1 },
      { name: 'Defaulted', value: 1 },
    ]);
  });
});
