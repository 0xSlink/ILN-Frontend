import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LPMaturityExposure from '../LPMaturityExposure';
import type { Invoice } from '@/utils/soroban';

const NOW = Date.parse('2026-01-01T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const seconds = (millis: number) => BigInt(Math.floor(millis / 1000));

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1n,
    status: 'Funded',
    freelancer: 'GFREELANCER',
    payer: 'GPAYER',
    funder: 'GLP',
    amount: 1_000n,
    due_date: seconds(NOW + 30 * DAY),
    discount_rate: 300,
    ...overrides,
  };
}

describe('LPMaturityExposure', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups outstanding funded principal and isolates missing due dates', () => {
    render(
      <LPMaturityExposure
        now={NOW}
        dataUpdatedAt={NOW - 1_000}
        invoices={[
          invoice({ id: 1n, amount: 1_000_000_000n, due_date: seconds(NOW - DAY) }),
          invoice({ id: 2n, amount: 2_000_000_000n, due_date: seconds(NOW + 2 * DAY) }),
          invoice({ id: 3n, amount: 3_000_000_000n, due_date: 0n }),
          invoice({ id: 4n, status: 'Paid', amount: 9_000_000_000n }),
        ]}
      />
    );

    expect(screen.getByTestId('lp-maturity-exposure')).toHaveAttribute('data-status', 'verified');
    expect(screen.getByTestId('lp-maturity-bucket-overdue')).toHaveTextContent('100 USDC');
    expect(screen.getByTestId('lp-maturity-bucket-within7d')).toHaveTextContent('200 USDC');
    expect(screen.getByTestId('lp-maturity-bucket-unknown')).toHaveAttribute(
      'data-quality',
      'missing'
    );
    expect(screen.getByTestId('lp-maturity-bucket-unknown')).toHaveTextContent('300 USDC');
    expect(screen.getByTestId('lp-maturity-bucket-later')).toHaveTextContent('0');
    expect(screen.queryByText('900 USDC')).not.toBeInTheDocument();
  });

  it('labels stale data as last-known and offers a retry', () => {
    const onRetry = vi.fn();
    render(
      <LPMaturityExposure
        now={NOW}
        dataUpdatedAt={NOW - 61_000}
        onRetry={onRetry}
        invoices={[invoice({ id: 1n })]}
      />
    );

    expect(screen.getByTestId('lp-maturity-exposure')).toHaveAttribute('data-status', 'stale');
    expect(screen.getByTestId('lp-maturity-status-detail')).toHaveTextContent('not live');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('keeps a failed read visible and unavailable instead of showing an empty view', () => {
    render(<LPMaturityExposure now={NOW} isError dataUpdatedAt={NOW - 1_000} invoices={[]} />);

    expect(screen.getByTestId('lp-maturity-exposure')).toHaveAttribute(
      'data-status',
      'unavailable'
    );
    expect(screen.getByTestId('lp-maturity-data-status')).toHaveAttribute('role', 'alert');
  });

  it('renders nothing for an empty verified portfolio', () => {
    const { container } = render(
      <LPMaturityExposure now={NOW} dataUpdatedAt={NOW - 1_000} invoices={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
