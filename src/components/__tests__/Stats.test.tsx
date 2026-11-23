import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stats from '../Stats';

const useContractStatsMock = vi.fn();
vi.mock('@/hooks/useContractStats', () => ({
  useContractStats: (...args: unknown[]) => useContractStatsMock(...args),
}));

vi.mock('@/components/InvoiceStateDonut', () => ({
  __esModule: true,
  default: () => <div data-testid="invoice-state-donut" />,
}));

describe('Stats (#1271)', () => {
  beforeEach(() => {
    useContractStatsMock.mockReset();
  });

  it('renders verified RPC values without hardcoded yield or LP claims', () => {
    useContractStatsMock.mockReturnValue({
      data: { total_invoices: 12, total_volume_usd: 1_250_000 },
      isLoading: false,
      isError: false,
    });

    render(<Stats />);

    expect(screen.getByTestId('stat-total-invoices')).toHaveTextContent('12');
    expect(screen.getByTestId('stat-volume')).toHaveTextContent('$1.3M');
    expect(screen.getByTestId('stat-avg-yield')).toHaveTextContent('Unavailable');
    expect(screen.getByTestId('stat-active-lps')).toHaveTextContent('Unavailable');
    expect(screen.queryByText('3.2%')).not.toBeInTheDocument();
    expect(screen.queryByText('89')).not.toBeInTheDocument();
    expect(screen.getByTestId('data-source-caption')).toHaveTextContent('Provenance: RPC');
  });

  it('renders honest unavailable states when the RPC read fails', () => {
    useContractStatsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<Stats />);

    expect(screen.getByTestId('stat-total-invoices')).toHaveAttribute('data-status', 'unavailable');
    expect(screen.getByTestId('stat-total-invoices')).toHaveTextContent('Unavailable');
    expect(screen.getByTestId('stat-volume')).toHaveTextContent('Unavailable');
    expect(screen.getByTestId('data-source-caption')).toHaveTextContent('Provenance: Unavailable');
  });

  it('does not render a silent zero while stats are loading', () => {
    useContractStatsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<Stats />);

    expect(screen.queryByText('$0')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
