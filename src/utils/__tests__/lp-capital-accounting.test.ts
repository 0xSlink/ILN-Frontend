import { describe, expect, it } from 'vitest';
import type { Invoice } from '../soroban';
import {
  calculateCapitalBreakdown,
  deriveLPDataStatus,
  groupMaturityExposure,
  hasUsableDueDate,
  maturityBucketForDueDate,
  remainingPrincipal,
} from '../lp-capital-accounting';

const NOW = Date.parse('2026-01-01T00:00:00.000Z');
const SECONDS = (millis: number) => BigInt(Math.floor(millis / 1000));

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1n,
    status: 'Funded',
    freelancer: 'GFREELANCER',
    payer: 'GPAYER',
    funder: 'GLP',
    amount: 1_000n,
    due_date: SECONDS(NOW + 30 * 24 * 60 * 60 * 1000),
    discount_rate: 300,
    ...overrides,
  };
}

describe('deriveLPDataStatus', () => {
  it('distinguishes loading, unavailable, stale and verified reads', () => {
    expect(deriveLPDataStatus({ isLoading: true, now: NOW })).toBe('loading');
    expect(deriveLPDataStatus({ isError: true, dataUpdatedAt: NOW - 1_000, now: NOW })).toBe(
      'unavailable'
    );
    expect(deriveLPDataStatus({ now: NOW })).toBe('unavailable');
    expect(deriveLPDataStatus({ dataUpdatedAt: NOW - 61_000, now: NOW })).toBe('stale');
    expect(deriveLPDataStatus({ dataUpdatedAt: NOW + 120_000, now: NOW })).toBe('stale');
    expect(deriveLPDataStatus({ dataUpdatedAt: NOW - 1_000, now: NOW })).toBe('verified');
  });
});

describe('capital accounting', () => {
  it('clamps partial repayments and ignores non-funded statuses', () => {
    expect(remainingPrincipal(invoice({ amount: 1_000n, amount_paid: 250n }))).toBe(750n);
    expect(remainingPrincipal(invoice({ amount: 1_000n, amount_paid: 1_500n }))).toBe(0n);
    expect(hasUsableDueDate(invoice({ due_date: 0n }))).toBe(false);
  });

  it('separates committed, outstanding and settled capital without double counting', () => {
    const breakdown = calculateCapitalBreakdown([
      invoice({ id: 1n, status: 'Funded', amount: 1_000n, amount_paid: 200n }),
      invoice({ id: 2n, status: 'Disputed', amount: 500n }),
      invoice({ id: 3n, status: 'Paid', amount: 700n }),
      invoice({ id: 4n, status: 'Pending', amount: 900n }),
      invoice({ id: 5n, status: 'Defaulted', amount: 100n }),
      invoice({ id: 6n, status: 'Cancelled', amount: 50n }),
    ]);

    expect(breakdown).toEqual({
      committedCapital: 1_500n,
      outstandingObligations: 1_300n,
      settledCapital: 700n,
      committedPositions: 2,
      settledPositions: 1,
    });
  });
});

describe('maturity exposure', () => {
  it('maps verified due dates into fixed buckets', () => {
    expect(maturityBucketForDueDate(Number(SECONDS(NOW - 1_000)), NOW)).toBe('overdue');
    expect(maturityBucketForDueDate(Number(SECONDS(NOW + 24 * 60 * 60 * 1000)), NOW)).toBe(
      'within7d'
    );
    expect(maturityBucketForDueDate(Number(SECONDS(NOW + 10 * 24 * 60 * 60 * 1000)), NOW)).toBe(
      'within30d'
    );
    expect(maturityBucketForDueDate(Number(SECONDS(NOW + 60 * 24 * 60 * 60 * 1000)), NOW)).toBe(
      'within90d'
    );
    expect(maturityBucketForDueDate(Number(SECONDS(NOW + 120 * 24 * 60 * 60 * 1000)), NOW)).toBe(
      'later'
    );
    expect(maturityBucketForDueDate(0, NOW)).toBe('unknown');
  });

  it('excludes settled positions and isolates missing due dates', () => {
    const exposure = groupMaturityExposure(
      [
        invoice({ id: 1n, amount: 100n, due_date: SECONDS(NOW - 1_000) }),
        invoice({ id: 2n, amount: 200n, due_date: SECONDS(NOW + 2 * 24 * 60 * 60 * 1000) }),
        invoice({ id: 3n, amount: 300n, due_date: SECONDS(NOW + 45 * 24 * 60 * 60 * 1000) }),
        invoice({ id: 4n, amount: 400n, due_date: 0n }),
        invoice({ id: 5n, amount: 500n, amount_paid: 500n, due_date: 0n }),
        invoice({ id: 6n, status: 'Paid', amount: 600n, due_date: SECONDS(NOW) }),
      ],
      NOW
    );

    expect(exposure.totalPositions).toBe(5);
    expect(exposure.totalOutstanding).toBe(1_000n);
    expect(exposure.missingDueDateCount).toBe(2);
    expect(
      exposure.buckets.map((bucket) => [
        bucket.id,
        bucket.positionCount,
        bucket.outstandingPrincipal,
      ])
    ).toEqual([
      ['overdue', 1, 100n],
      ['within7d', 1, 200n],
      ['within30d', 0, 0n],
      ['within90d', 1, 300n],
      ['later', 0, 0n],
      ['unknown', 2, 400n],
    ]);
  });
});
