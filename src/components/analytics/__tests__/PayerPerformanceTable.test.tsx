import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PayerPerformanceTable from '../PayerPerformanceTable';
import type { PayerPerformance } from '@/utils/lp-analytics';

function payer(overrides: Partial<PayerPerformance> = {}): PayerPerformance {
  return {
    payer: 'GPAYERADDRESSLONGENOUGH1234',
    totalInvoices: 3,
    totalYield: 50_000_000n,
    defaultRate: 0,
    fundedAmount: 200_000_000n,
    ...overrides,
  };
}

const createObjectURLMock = vi.fn(() => 'blob:csv-url');
const clickMock = vi.fn();

describe('PayerPerformanceTable', () => {
  beforeEach(() => {
    createObjectURLMock.mockClear();
    clickMock.mockClear();
    (global as any).URL.createObjectURL = createObjectURLMock;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickMock);
  });

  it('renders nothing when there is no data', () => {
    const { container } = render(<PayerPerformanceTable data={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders payer rows sorted by total invoices descending by default', () => {
    render(
      <PayerPerformanceTable
        data={[
          payer({ payer: 'GLOW', totalInvoices: 1 }),
          payer({ payer: 'GHIGH', totalInvoices: 9 }),
        ]}
      />
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('GHIG');
    expect(rows[1]).toHaveTextContent('GLOW');
  });

  it('flags high default-rate payers as Risk and high-yield payers as Top', () => {
    render(<PayerPerformanceTable data={[payer({ defaultRate: 12, totalYield: 200_000_000n })]} />);
    expect(screen.getByText('Risk')).toBeInTheDocument();
    expect(screen.getByText('Top')).toBeInTheDocument();
  });

  it('toggles sort order when clicking the same column header twice', () => {
    render(
      <PayerPerformanceTable
        data={[
          payer({ payer: 'GLOW', totalInvoices: 1 }),
          payer({ payer: 'GHIGH', totalInvoices: 9 }),
        ]}
      />
    );
    const header = screen.getByText(/Invoices/);
    fireEvent.click(header); // now ascending
    let rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('GLOW');

    fireEvent.click(header); // back to descending
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('GHIG');
  });

  it('switches sort key when clicking a different column header', () => {
    render(
      <PayerPerformanceTable
        data={[
          payer({ payer: 'GLOWYIELD', totalInvoices: 9, totalYield: 1n }),
          payer({ payer: 'GHIYIELD', totalInvoices: 1, totalYield: 500_000_000n }),
        ]}
      />
    );
    fireEvent.click(screen.getByText(/Total Yield/));
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('GHIY');
  });

  it('exports the sorted data as a CSV download', () => {
    render(<PayerPerformanceTable data={[payer()]} />);
    fireEvent.click(screen.getByText('Export CSV'));
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
  });
});
