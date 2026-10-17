import { expect, test, describe } from 'vitest';
import { calculateLPMetrics, getOutcomeBreakdown, getPayerPerformance } from '@/utils/lp-analytics';
import { Invoice } from '@/utils/soroban';

const mockAddress = 'GCLP123456789';
const mockInvoices: Invoice[] = [
  {
    id: 1n,
    freelancer: 'GCF1',
    payer: 'GCP1',
    amount: 1000_0000000n,
    due_date: 1700000000n,
    discount_rate: 300, // 3%
    status: 'Paid',
    funder: mockAddress,
    funded_at: 1690000000n,
  },
  {
    id: 2n,
    freelancer: 'GCF2',
    payer: 'GCP2',
    amount: 500_0000000n,
    due_date: 1710000000n,
    discount_rate: 500, // 5%
    status: 'Defaulted',
    funder: mockAddress,
    funded_at: 1695000000n,
  },
  {
    id: 3n,
    freelancer: 'GCF3',
    payer: 'GCP1',
    amount: 2000_0000000n,
    due_date: 1720000000n,
    discount_rate: 200, // 2%
    status: 'Funded',
    funder: mockAddress,
    funded_at: 1700000000n,
  },
];

describe('LP Analytics Utils', () => {
  test('calculateLPMetrics correctly computes KPIs', () => {
    const metrics = calculateLPMetrics(mockInvoices, mockAddress);

    // Total Capital: 1000 + 500 + 2000 = 3500
    expect(metrics.totalCapitalDeployed).toBe(3500_0000000n);

    // Total Yield Earned (Only from Paid): 1000 * 3% = 30
    expect(metrics.totalYieldEarned).toBe(30_0000000n);

    // Default Rate: 1 defaulted out of 3 = 33.33%
    expect(metrics.defaultRate).toBeCloseTo(33.33, 1);

    // Avg Yield Rate: (300 + 500 + 200) / 3 = 333.33 bps = 3.33%
    expect(metrics.avgYieldRate).toBeCloseTo(3.33, 1);
  });

  test('getOutcomeBreakdown groups statuses correctly', () => {
    const data = getOutcomeBreakdown(mockInvoices, mockAddress);
    const paid = data.find((d) => d.name === 'Paid')?.value;
    const defaulted = data.find((d) => d.name === 'Defaulted')?.value;
    const active = data.find((d) => d.name === 'Active')?.value;

    expect(paid).toBe(1);
    expect(defaulted).toBe(1);
    expect(active).toBe(1);
  });

  test('getPayerPerformance aggregates data per payer', () => {
    const data = getPayerPerformance(mockInvoices, mockAddress);
    const gcp1 = data.find((d) => d.payer === 'GCP1');

    expect(gcp1?.totalInvoices).toBe(2);
    expect(gcp1?.fundedAmount).toBe(3000_0000000n);
    expect(gcp1?.totalYield).toBe(30_0000000n); // Only the paid one
  });

  test('calculateLPMetrics handles empty state', () => {
    const metrics = calculateLPMetrics([], mockAddress);
    expect(metrics.totalCapitalDeployed).toBe(0n);
    expect(metrics.totalYieldEarned).toBe(0n);
    expect(metrics.avgYieldRate).toBe(0);
  });

  test('calculateLPMetrics filters by address', () => {
    const metrics = calculateLPMetrics(mockInvoices, 'OTHER_ADDRESS');
    expect(metrics.totalCapitalDeployed).toBe(0n);
  });
});
