import { describe, expect, it } from 'vitest';

import { applyFreelancerFiltersAndSort } from '../Dashboard';
import type { Invoice } from '../../../utils/soroban';

function makeInvoice(id: bigint, status: string, amount: bigint, dueDate: bigint): Invoice {
  return {
    id,
    freelancer: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    payer: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBRY',
    amount,
    due_date: dueDate,
    discount_rate: 300,
    status,
    funder: undefined,
    funded_at: undefined,
  };
}

describe('freelancer dashboard filter and sort', () => {
  const invoices = [
    makeInvoice(1n, 'Pending', 40n, 200n),
    makeInvoice(2n, 'Paid', 20n, 300n),
    makeInvoice(3n, 'Funded', 60n, 100n),
    makeInvoice(4n, 'Defaulted', 10n, 400n),
  ];

  it('filters by status', () => {
    const funded = applyFreelancerFiltersAndSort(invoices, 'Funded', 'due_date', 'asc');
    expect(funded).toHaveLength(1);
    expect(funded[0].id).toBe(3n);
  });

  it('sorts by amount ascending and descending', () => {
    const asc = applyFreelancerFiltersAndSort(invoices, 'All', 'amount', 'asc');
    expect(asc.map((invoice) => invoice.id)).toEqual([4n, 2n, 1n, 3n]);

    const desc = applyFreelancerFiltersAndSort(invoices, 'All', 'amount', 'desc');
    expect(desc.map((invoice) => invoice.id)).toEqual([3n, 1n, 2n, 4n]);
  });

  it('sorts by due date ascending', () => {
    const sorted = applyFreelancerFiltersAndSort(invoices, 'All', 'due_date', 'asc');
    expect(sorted.map((invoice) => invoice.id)).toEqual([3n, 1n, 2n, 4n]);
  });
});
