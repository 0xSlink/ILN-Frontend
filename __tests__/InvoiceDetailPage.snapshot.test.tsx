import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Invoice } from '@/utils/soroban';
import { formatAddress, formatDate, formatUSDC } from '@/utils/format';
import { allInvoiceFixtures } from './fixtures/invoices';

function InvoiceDetailPageSnapshot({ invoice }: { invoice: Invoice }) {
  const statusTone =
    invoice.status === 'Pending'
      ? 'bg-amber-100 text-amber-800'
      : invoice.status === 'Funded'
        ? 'bg-blue-100 text-blue-800'
        : invoice.status === 'PartiallyFunded'
          ? 'bg-sky-100 text-sky-800'
          : invoice.status === 'Paid'
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-red-100 text-red-800';

  return (
    <article className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-outline-variant/10 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Invoice Detail</p>
          <h2 className="mt-2 text-2xl font-bold">Invoice #{invoice.id.toString()}</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusTone}`}>
          {invoice.status}
        </span>
      </div>

      <dl className="mt-6 grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-on-surface-variant">Freelancer</dt>
          <dd className="font-mono">{formatAddress(invoice.freelancer)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-on-surface-variant">Payer</dt>
          <dd className="font-mono">{formatAddress(invoice.payer)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-on-surface-variant">Face value</dt>
          <dd className="font-bold">{formatUSDC(invoice.amount)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-on-surface-variant">Discount</dt>
          <dd>{(invoice.discount_rate / 100).toFixed(2)}%</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-on-surface-variant">Due date</dt>
          <dd>{formatDate(invoice.due_date)}</dd>
        </div>
      </dl>
    </article>
  );
}

describe('Invoice detail snapshots', () => {
  it.each(allInvoiceFixtures.map((invoice) => [invoice.status, invoice] as const))(
    'matches the detail view for %s status',
    (_status, invoice) => {
      const { asFragment } = render(<InvoiceDetailPageSnapshot invoice={invoice} />);

      expect(asFragment()).toMatchSnapshot();
    }
  );
});
