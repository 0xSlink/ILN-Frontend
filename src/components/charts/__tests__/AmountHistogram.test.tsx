import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import AmountHistogram, {
  getBucketIndex,
  aggregateHistogramData,
  calculateMedian,
} from '../AmountHistogram';
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

describe('AmountHistogram rendering', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  it('shows the invoice source, provenance, ledger, and time for indexed history', () => {
    const { container } = render(
      <AmountHistogram
        invoices={mockInvoices}
        sourceLedger={51234567}
        sourceTime="2026-11-23T00:00:00Z"
      />
    );

    expect(screen.getByTestId('data-source-caption')).toHaveTextContent('Provenance: RPC');
    expect(screen.getByTestId('invoice-volume-source-ledger')).toHaveTextContent(
      'ledger 51234567 • as of 2026-11-23T00:00:00.000Z'
    );
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('shows an explicit no-history state instead of zeroed buckets and a $0 median', () => {
    const { container } = render(<AmountHistogram invoices={[]} />);

    expect(screen.getByTestId('invoice-volume-no-history')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-volume-source-ledger')).toHaveTextContent(
      'ledger not reported • as of not reported'
    );
    expect(screen.queryByText('Median Invoice Amount')).not.toBeInTheDocument();
    expect(container.querySelector('.recharts-responsive-container')).not.toBeInTheDocument();
  });

  it('distinguishes an unavailable history source from an empty result', () => {
    render(<AmountHistogram invoices={mockInvoices} historyUnavailable />);

    expect(screen.getByTestId('invoice-volume-no-history')).toHaveTextContent(
      'Historical invoice volume data is unavailable'
    );
    expect(screen.getByTestId('invoice-volume-source-ledger')).toHaveTextContent(
      'unavailable (no historical indexer data)'
    );
    expect(screen.queryByText('Median Invoice Amount')).not.toBeInTheDocument();
  });
});

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
