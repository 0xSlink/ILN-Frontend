import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InvoiceTimeline from '../InvoiceTimeline';
import type { Invoice } from '@/utils/soroban';

const NOW = new Date('2026-06-15T12:00:00.000Z').getTime();

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1n,
    freelancer: 'GFREELANCER1234567890',
    payer: 'GPAYER1234567890',
    amount: 500_000_000n,
    due_date: BigInt(Math.floor(NOW / 1000) + 86400 * 10),
    discount_rate: 400,
    status: 'Pending',
    token: '',
    ...overrides,
  } as Invoice;
}

describe('InvoiceTimeline detail panel and pagination', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('expands a card to show the detail panel and collapses it again', () => {
    const inv = invoice({
      id: 7n,
      status: 'Funded',
      funded_at: BigInt(Math.floor(NOW / 1000)),
      funder: 'GFUNDER1234567890',
    });
    render(<InvoiceTimeline invoices={[inv]} loading={false} />);

    const toggleButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(toggleButton);

    expect(screen.getByRole('region', { name: 'Details for invoice #7' })).toBeInTheDocument();
    expect(screen.getByText('4.00%')).toBeInTheDocument();
    expect(screen.getByText('View Invoice')).toBeInTheDocument();
    // Funded-only actions
    expect(screen.getByText('Mark as Paid')).toBeInTheDocument();
    expect(screen.getByText('Dispute')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close detail panel'));
    expect(
      screen.queryByRole('region', { name: 'Details for invoice #7' })
    ).not.toBeInTheDocument();
  });

  it('shows an explorer link only when the invoice carries a tx_hash', () => {
    const withHash = { ...invoice({ id: 8n }), tx_hash: 'deadbeef' } as Invoice & {
      tx_hash: string;
    };
    render(
      <InvoiceTimeline
        invoices={[withHash]}
        loading={false}
        explorerBaseUrl="https://explorer.example/tx/"
      />
    );

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const link = screen.getByText('Explorer').closest('a');
    expect(link).toHaveAttribute('href', 'https://explorer.example/tx/deadbeef');
  });

  it('omits the explorer link and Funded-only actions for a Pending invoice', () => {
    render(<InvoiceTimeline invoices={[invoice({ id: 9n, status: 'Pending' })]} loading={false} />);

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.queryByText('Explorer')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark as Paid')).not.toBeInTheDocument();
    expect(screen.queryByText('Dispute')).not.toBeInTheDocument();
  });

  it('dispatches an iln:open-dispute event when Dispute is clicked', () => {
    const handler = vi.fn();
    document.addEventListener('iln:open-dispute', handler);

    render(
      <InvoiceTimeline
        invoices={[
          invoice({ id: 11n, status: 'Funded', funded_at: BigInt(Math.floor(NOW / 1000)) }),
        ]}
        loading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByText('Dispute'));

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ invoiceId: '11' });

    document.removeEventListener('iln:open-dispute', handler);
  });

  it('shows status-specific timeline labels', () => {
    const invoices = [
      invoice({ id: 1n, status: 'Paid' }),
      invoice({ id: 2n, status: 'Defaulted' }),
      invoice({ id: 3n, status: 'Disputed' }),
    ];
    render(<InvoiceTimeline invoices={invoices} loading={false} />);

    expect(screen.getByText('Settled in full')).toBeInTheDocument();
    expect(screen.getByText('Defaulted — escalated')).toBeInTheDocument();
    expect(screen.getByText('Under dispute')).toBeInTheDocument();
  });

  it('shows a "Load more" button once there are more than 20 events, revealing more on click', () => {
    const invoices = Array.from({ length: 25 }, (_, i) =>
      invoice({ id: BigInt(i + 1), due_date: BigInt(Math.floor(NOW / 1000) + 86400 * 10) })
    );
    render(<InvoiceTimeline invoices={invoices} loading={false} />);

    expect(screen.getAllByRole('button', { expanded: false }).length).toBe(20);
    fireEvent.click(screen.getByText('Load more'));

    expect(screen.getAllByRole('button', { expanded: false }).length).toBe(25);
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });
});
