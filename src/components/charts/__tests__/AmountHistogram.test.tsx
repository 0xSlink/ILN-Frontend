import { describe, it, expect } from 'vitest';
import { getBucketIndex, aggregateHistogramData, calculateMedian } from '../AmountHistogram';
import { Invoice } from '../../../utils/soroban';

// Amounts use the 6-decimal USDC scale that tokenAmountToNumber() assumes.
const mockInvoices: Invoice[] = [
  {
    id: 1n,
    amount: 50_000000n,
    status: 'Funded',
    freelancer: 'A',
    payer: 'B',
    due_date: 0n,
    discount_rate: 0,
  }, // $50 (Bucket 0)
  {
    id: 2n,
    amount: 150_000000n,
    status: 'Paid',
    freelancer: 'A',
    payer: 'B',
    due_date: 0n,
    discount_rate: 0,
  }, // $150 (Bucket 1)
  {
    id: 3n,
    amount: 600_000000n,
    status: 'Defaulted',
    freelancer: 'A',
    payer: 'B',
    due_date: 0n,
    discount_rate: 0,
  }, // $600 (Bucket 2)
  {
    id: 4n,
    amount: 2000_000000n,
    status: 'Pending',
    freelancer: 'A',
    payer: 'B',
    due_date: 0n,
    discount_rate: 0,
  }, // $2000 (Bucket 3)
  {
    id: 5n,
    amount: 7000_000000n,
    status: 'Funded',
    freelancer: 'A',
    payer: 'B',
    due_date: 0n,
    discount_rate: 0,
  }, // $7000 (Bucket 4)
  {
    id: 6n,
    amount: 15000_000000n,
    status: 'Paid',
    freelancer: 'A',
    payer: 'B',
    due_date: 0n,
    discount_rate: 0,
  }, // $15000 (Bucket 5)
];

describe('AmountHistogram Utilities', () => {
  describe('getBucketIndex', () => {
    it('assigns amounts to correct bucket indices', () => {
      expect(getBucketIndex(50)).toBe(0);
      expect(getBucketIndex(100)).toBe(0);
      expect(getBucketIndex(101)).toBe(1);
      expect(getBucketIndex(500)).toBe(1);
      expect(getBucketIndex(501)).toBe(2);
      expect(getBucketIndex(1000)).toBe(2);
      expect(getBucketIndex(1001)).toBe(3);
      expect(getBucketIndex(5000)).toBe(3);
      expect(getBucketIndex(5001)).toBe(4);
      expect(getBucketIndex(10000)).toBe(4);
      expect(getBucketIndex(10001)).toBe(5);
    });
  });

  describe('aggregateHistogramData', () => {
    it('correctly aggregates counts and volume per bucket and status', () => {
      const data = aggregateHistogramData(mockInvoices);

      // Bucket 0: $50, Funded
      expect(data[0].count).toBe(1);
      expect(data[0].funded).toBe(1);
      expect(data[0].volume).toBe(50);
      expect(data[0].volume_funded).toBe(50);

      // Bucket 1: $150, Paid
      expect(data[1].count).toBe(1);
      expect(data[1].paid).toBe(1);
      expect(data[1].volume_paid).toBe(150);

      // Bucket 5: $15000, Paid
      expect(data[5].count).toBe(1);
      expect(data[5].paid).toBe(1);
      expect(data[5].volume).toBe(15000);
    });
  });

  describe('calculateMedian', () => {
    it('calculates median for even number of invoices', () => {
      const invoices: Invoice[] = [
        {
          id: 1n,
          amount: 100_000000n,
          status: 'A',
          freelancer: 'A',
          payer: 'B',
          due_date: 0n,
          discount_rate: 0,
        },
        {
          id: 2n,
          amount: 200_000000n,
          status: 'A',
          freelancer: 'A',
          payer: 'B',
          due_date: 0n,
          discount_rate: 0,
        },
      ];
      expect(calculateMedian(invoices)).toBe(150);
    });

    it('calculates median for odd number of invoices', () => {
      const invoices: Invoice[] = [
        {
          id: 1n,
          amount: 100_000000n,
          status: 'A',
          freelancer: 'A',
          payer: 'B',
          due_date: 0n,
          discount_rate: 0,
        },
        {
          id: 2n,
          amount: 200_000000n,
          status: 'A',
          freelancer: 'A',
          payer: 'B',
          due_date: 0n,
          discount_rate: 0,
        },
        {
          id: 3n,
          amount: 300_000000n,
          status: 'A',
          freelancer: 'A',
          payer: 'B',
          due_date: 0n,
          discount_rate: 0,
        },
      ];
      expect(calculateMedian(invoices)).toBe(200);
    });

    it('returns 0 for empty list', () => {
      expect(calculateMedian([])).toBe(0);
    });
  });
});
