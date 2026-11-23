import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InvoiceMarketplaceCard, { getInvoiceFundingBlockReason } from '../InvoiceMarketplaceCard';
import type { Invoice, TokenMetadata } from '@/utils/soroban';

const token: TokenMetadata = {
  contractId: 'CUSDC',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 7,
};

const tokenMap = new Map<string, TokenMetadata>([['CUSDC', token]]);

const pendingInvoice: Invoice = {
  id: 101n,
  status: 'Pending',
  freelancer: 'GFREELANCER123456789',
  payer: 'GPAYER123456789',
  amount: 5_000_000_000n,
  due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 14),
  discount_rate: 400,
  token: 'CUSDC',
};

const baseProps = {
  tokenMap,
  defaultToken: token,
  payerScore: { score: 85, settled_on_time: 10, defaults: 0 },
  payerRisk: 'Low' as const,
  isWalletConnected: true,
};

describe('InvoiceMarketplaceCard stale-state guards', () => {
  it.each([
    ['Funded', 'Invoice has already been funded.'],
    ['Cancelled', 'Invoice has been cancelled.'],
    ['Disputed', 'Invoice is currently disputed.'],
    ['Paid', 'Invoice has already been paid.'],
    ['Defaulted', 'Invoice has defaulted.'],
  ])('blocks funding when invoice status is %s', (status, expectedReason) => {
    const onFund = vi.fn();
    const onQuickFund = vi.fn();

    render(
      <InvoiceMarketplaceCard
        {...baseProps}
        invoice={{ ...pendingInvoice, status }}
        onFund={onFund}
        onQuickFund={onQuickFund}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(expectedReason);
    expect(screen.queryByRole('button', { name: 'Fund Invoice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fund Now/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: status })).toBeDisabled();
    expect(onFund).not.toHaveBeenCalled();
    expect(onQuickFund).not.toHaveBeenCalled();
  });

  it('blocks funding when funder or funded_at is already set even if status is stale Pending', () => {
    expect(
      getInvoiceFundingBlockReason({
        ...pendingInvoice,
        funder: 'GLP123',
      })
    ).toBe('Invoice has already been funded.');
  });

  it('rechecks live status via onVerifyFundable and blocks stale funding submission', async () => {
    const onFund = vi.fn();
    const onVerifyFundable = vi.fn().mockResolvedValue({
      ...pendingInvoice,
      status: 'Funded',
      funder: 'GLP999',
    });

    render(
      <InvoiceMarketplaceCard
        {...baseProps}
        invoice={pendingInvoice}
        onFund={onFund}
        onVerifyFundable={onVerifyFundable}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fund Invoice' }));

    await waitFor(() => {
      expect(onVerifyFundable).toHaveBeenCalledWith(pendingInvoice);
    });
    expect(onFund).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Invoice has already been funded.');
    expect(screen.getByRole('button', { name: 'Funded' })).toBeDisabled();
  });

  it('shows an error and blocks submission when live status recheck fails', async () => {
    const onFund = vi.fn();
    const onVerifyFundable = vi.fn().mockRejectedValue(new Error('RPC timeout'));

    render(
      <InvoiceMarketplaceCard
        {...baseProps}
        invoice={pendingInvoice}
        onFund={onFund}
        onVerifyFundable={onVerifyFundable}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fund Invoice' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to verify live invoice status. Please refresh and try again.'
      );
    });
    expect(onFund).not.toHaveBeenCalled();
  });

  it('proceeds to onFund with the refreshed invoice when live status is still Pending', async () => {
    const onFund = vi.fn();
    const refreshedInvoice = { ...pendingInvoice };
    const onVerifyFundable = vi.fn().mockResolvedValue(refreshedInvoice);

    render(
      <InvoiceMarketplaceCard
        {...baseProps}
        invoice={pendingInvoice}
        onFund={onFund}
        onVerifyFundable={onVerifyFundable}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fund Invoice' }));

    await waitFor(() => {
      expect(onFund).toHaveBeenCalledWith(refreshedInvoice);
    });
  });
});
