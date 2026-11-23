import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LPPortfolio from '../LPPortfolio';
import type { ApprovedToken } from '@/hooks/useApprovedTokens';
import type { Invoice } from '@/utils/soroban';

const TOKEN: ApprovedToken = {
  contractId: 'USDC',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 7,
  iconLabel: 'US',
  logo: '',
  isAllowed: true,
};

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1n,
    status: 'Funded',
    freelancer: 'GFREELANCER',
    payer: 'GPAYER',
    funder: 'GLP',
    amount: 10_000_000_000n,
    due_date: 2_000_000_000n,
    discount_rate: 300,
    token: TOKEN.contractId,
    ...overrides,
  };
}

function renderPortfolio(overrides: Partial<React.ComponentProps<typeof LPPortfolio>> = {}) {
  return render(
    <LPPortfolio
      invoices={[]}
      isLoading={false}
      onClaimDefault={vi.fn()}
      claimingInvoiceId={null}
      {...overrides}
    />
  );
}

describe('LPPortfolio capital breakdown', () => {
  it('separates committed, outstanding and settled capital', () => {
    renderPortfolio({
      invoices: [
        invoice({ id: 1n, status: 'Funded', amount: 10_000_000_000n, amount_paid: 2_000_000_000n }),
        invoice({ id: 2n, status: 'Disputed', amount: 5_000_000_000n }),
        invoice({ id: 3n, status: 'Paid', amount: 7_000_000_000n }),
        invoice({ id: 4n, status: 'Pending', amount: 99_000_000_000n }),
      ],
    });

    expect(screen.getByTestId('lp-capital-committed')).toHaveTextContent('1,500 USDC');
    expect(screen.getByTestId('lp-capital-outstanding')).toHaveTextContent('1,300 USDC');
    expect(screen.getByTestId('lp-capital-settled')).toHaveTextContent('700 USDC');
    expect(screen.getByTestId('lp-capital-withdrawable')).toHaveAttribute(
      'data-status',
      'unavailable'
    );
    expect(screen.getByTestId('lp-capital-withdrawable')).toHaveTextContent(
      'no on-chain withdrawal/claimable-balance read is implemented'
    );
  });

  it('does not present an unconnected wallet as a zero balance', () => {
    renderPortfolio();

    expect(screen.getByTestId('lp-capital-wallet')).toHaveAttribute('data-status', 'not-connected');
    expect(screen.getByTestId('lp-capital-wallet')).toHaveTextContent('Connect a wallet');
  });

  it('renders per-token verified balances from the balance read', () => {
    renderPortfolio({
      walletBalanceStatus: 'verified',
      walletBalances: new Map([[TOKEN.contractId, 3_000_000_000n]]),
      tokenMap: new Map([[TOKEN.contractId, TOKEN]]),
    });

    expect(screen.getByTestId('lp-capital-wallet')).toHaveTextContent('300 USDC');
  });

  it('shows an honest unavailable state when balance reads fail', () => {
    renderPortfolio({ walletBalanceStatus: 'unavailable' });

    expect(screen.getByTestId('lp-capital-wallet')).toHaveTextContent('Wallet balance unavailable');
  });
});
