import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import YieldAnalyticsChart from '../YieldAnalyticsChart';
import type { Invoice } from '@/utils/soroban';

const LP = 'GLP0000000000000000000000000000000000000000000000000000';
const NOW = Math.floor(Date.now() / 1000);

function paidInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1n,
    freelancer: 'GFR1',
    payer: 'GPAYER1',
    amount: 10_000_000n,
    due_date: BigInt(NOW + 86_400),
    discount_rate: 500,
    status: 'Paid',
    funder: LP,
    funded_at: BigInt(NOW - 7 * 86_400),
    token: 'token-usdc',
    ...overrides,
  };
}

describe('YieldAnalyticsChart', () => {
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

  it('labels the verified RPC source and reports zero verified inputs as insufficient history', () => {
    const { container } = render(<YieldAnalyticsChart invoices={[]} lpAddress={LP} />);

    expect(screen.getByTestId('yield-verified-inputs')).toHaveTextContent(
      '0 verified settled invoices'
    );
    expect(screen.getByTestId('data-source-caption')).toHaveTextContent('Provenance: RPC');
    expect(screen.getByTestId('yield-insufficient-history')).toHaveTextContent(
      'No estimated series is rendered'
    );
    expect(container.querySelector('.recharts-responsive-container')).not.toBeInTheDocument();
  });

  it('plots only settled invoices funded by the LP with a valid funding time', () => {
    const { container } = render(
      <YieldAnalyticsChart
        invoices={[
          paidInvoice(),
          paidInvoice({ id: 2n, funded_at: BigInt(NOW + 86_400) }),
          paidInvoice({ id: 3n, status: 'Funded' }),
          paidInvoice({ id: 4n, funder: 'GOTHER' }),
        ]}
        lpAddress={LP}
      />
    );

    expect(screen.getByTestId('yield-verified-inputs')).toHaveTextContent(
      '1 verified settled invoice'
    );
    expect(screen.queryByTestId('yield-insufficient-history')).not.toBeInTheDocument();
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('shows the loading skeleton without deriving any series while loading', () => {
    render(<YieldAnalyticsChart invoices={[paidInvoice()]} lpAddress={LP} isLoading />);
    expect(screen.getByLabelText('Loading yield chart')).toBeInTheDocument();
    expect(screen.queryByTestId('data-source-caption')).not.toBeInTheDocument();
  });

  it('exposes only supported day ranges', () => {
    render(<YieldAnalyticsChart invoices={[]} lpAddress={LP} />);
    expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '60d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '7d' })).not.toBeInTheDocument();
  });
});
