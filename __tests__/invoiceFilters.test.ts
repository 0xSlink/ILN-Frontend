import { describe, expect, it } from 'vitest';
import {
  applyInvoiceFilters,
  buildFilterQuery,
  countActiveInvoiceFilters,
  EMPTY_INVOICE_FILTERS,
  readFiltersFromParams,
} from '@/hooks/useInvoiceFilters';
import type { Invoice } from '@/utils/soroban';

function makeInvoice(
  id: bigint,
  status: Invoice['status'],
  amount: bigint,
  dueDate: bigint,
  discountRate: number,
  token?: string
): Invoice {
  return {
    id,
    freelancer: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    payer: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBRY',
    amount,
    due_date: dueDate,
    discount_rate: discountRate,
    status,
    token,
    funder: undefined,
    funded_at: undefined,
  };
}

describe('invoice filter logic', () => {
  // Amounts use the 6-decimal USDC scale that the amount filter assumes.
  const invoices: Invoice[] = [
    makeInvoice(101n, 'Pending', 100n * 1_000_000n, 1_760_000_000n, 300, 'token-usdc'),
    makeInvoice(202n, 'Funded', 500n * 1_000_000n, 1_770_000_000n, 900, 'token-eurc'),
    makeInvoice(303n, 'Paid', 900n * 1_000_000n, 1_780_000_000n, 1200, 'token-xlm'),
  ];

  it('searches by id and address fragments', () => {
    const byId = applyInvoiceFilters(invoices, { ...EMPTY_INVOICE_FILTERS, search: '202' });
    expect(byId.map((invoice) => invoice.id)).toEqual([202n]);

    const byAddress = applyInvoiceFilters(invoices, {
      ...EMPTY_INVOICE_FILTERS,
      search: 'aaaaaaa',
    });
    expect(byAddress).toHaveLength(3);
  });

  it('applies status, amount, due date, token, and discount ranges', () => {
    const filtered = applyInvoiceFilters(
      invoices,
      {
        ...EMPTY_INVOICE_FILTERS,
        statuses: ['Funded', 'Paid'],
        minAmount: '400',
        maxAmount: '950',
        startDate: '2026-01-01',
        endDate: '2026-07-30',
        token: 'EURC',
        minDiscountBps: '500',
        maxDiscountBps: '1000',
      },
      {
        resolveTokenSymbol: (invoice) => {
          if (invoice.token === 'token-eurc') return 'EURC';
          if (invoice.token === 'token-xlm') return 'XLM';
          return 'USDC';
        },
      }
    );

    expect(filtered.map((invoice) => invoice.id)).toEqual([202n]);
  });

  it('counts active filter groups correctly', () => {
    expect(
      countActiveInvoiceFilters({
        ...EMPTY_INVOICE_FILTERS,
        search: '10',
        statuses: ['Pending'],
        minAmount: '10',
        token: 'USDC',
      })
    ).toBe(4);
  });
});

describe('URL search params sync (issue 342)', () => {
  const NS = 'mkt';

  it('serialises filters into URL params with namespace prefix', () => {
    const params = buildFilterQuery(new URLSearchParams(), NS, {
      ...EMPTY_INVOICE_FILTERS,
      search: 'acme',
      statuses: ['Pending', 'Funded'],
      minAmount: '100',
      token: 'USDC',
    });

    expect(params.get('mkt_search')).toBe('acme');
    expect(params.get('mkt_statuses')).toBe('Pending,Funded');
    expect(params.get('mkt_minAmount')).toBe('100');
    expect(params.get('mkt_token')).toBe('USDC');
    // empty fields should not be present
    expect(params.has('mkt_maxAmount')).toBe(false);
  });

  it('deletes params when filters are cleared', () => {
    const existing = new URLSearchParams('mkt_search=old&mkt_token=EURC');
    const params = buildFilterQuery(existing, NS, EMPTY_INVOICE_FILTERS);

    expect(params.has('mkt_search')).toBe(false);
    expect(params.has('mkt_token')).toBe(false);
  });

  it('does not touch params from other namespaces', () => {
    const existing = new URLSearchParams('other_search=preserved');
    const params = buildFilterQuery(existing, NS, { ...EMPTY_INVOICE_FILTERS, search: 'new' });

    expect(params.get('other_search')).toBe('preserved');
    expect(params.get('mkt_search')).toBe('new');
  });

  it('reads filters back from URL params', () => {
    const params = new URLSearchParams(
      'mkt_search=hello&mkt_statuses=Paid,Defaulted&mkt_minAmount=50&mkt_token=EURC'
    );
    const filters = readFiltersFromParams(params, NS);

    expect(filters.search).toBe('hello');
    expect(filters.statuses).toEqual(['Paid', 'Defaulted']);
    expect(filters.minAmount).toBe('50');
    expect(filters.token).toBe('EURC');
    expect(filters.maxAmount).toBe('');
  });

  it('round-trips filters through URL params', () => {
    const original = {
      ...EMPTY_INVOICE_FILTERS,
      search: 'invoice',
      statuses: ['Funded' as const],
      minAmount: '200',
      maxAmount: '800',
      token: 'USDC',
      minDiscountBps: '100',
    };

    const params = buildFilterQuery(new URLSearchParams(), NS, original);
    const restored = readFiltersFromParams(params, NS);

    expect(restored).toEqual(original);
  });

  it('ignores invalid status values when reading from params', () => {
    const params = new URLSearchParams('mkt_statuses=Pending,INVALID,Paid');
    const filters = readFiltersFromParams(params, NS);
    expect(filters.statuses).toEqual(['Pending', 'Paid']);
  });
});
