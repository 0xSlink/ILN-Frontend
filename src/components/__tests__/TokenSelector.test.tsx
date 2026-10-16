import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import TokenSelector from '../TokenSelector';
import type { ApprovedToken } from '@/hooks/useApprovedTokens';

vi.mock('@/hooks/useBalances', () => ({
  useBalances: () => ({
    balances: new Map([
      ['token-usdc', 1_250_000_000n],
      ['token-eurc', 500_000_000n],
    ]),
    isLoading: false,
  }),
}));

const tokens: ApprovedToken[] = [
  {
    contractId: 'token-usdc',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 7,
    iconLabel: 'US',
    logo: '/tokens/usdc.svg',
    isAllowed: true,
  },
  {
    contractId: 'token-eurc',
    name: 'Euro Coin',
    symbol: 'EURC',
    decimals: 7,
    iconLabel: 'EU',
    logo: '/tokens/eurc.svg',
    isAllowed: true,
  },
  {
    contractId: 'token-xlm',
    name: 'Stellar Lumens',
    symbol: 'XLM',
    decimals: 7,
    iconLabel: 'XL',
    logo: '/tokens/xlm.svg',
    isAllowed: false,
    unavailableReason: 'XLM is not in the current invoice allowlist.',
  },
];

describe('TokenSelector', () => {
  test('renders token logo, symbol, and balance', () => {
    render(<TokenSelector label="Token" value="token-usdc" tokens={tokens} showBalances />);

    expect(screen.getByRole('button', { name: /USDC/i })).toBeInTheDocument();
    // The option list is rendered twice (desktop dropdown + mobile bottom
    // sheet), so the trigger's logo is the first image in the DOM.
    expect(screen.getAllByAltText('', { selector: 'img' })[0]).toHaveAttribute(
      'src',
      '/tokens/usdc.svg'
    );
    expect(screen.getAllByText('Balance: 125 USDC').length).toBeGreaterThan(0);
  });

  test('selects an allowed token from the dropdown', () => {
    const onChange = vi.fn();
    render(<TokenSelector label="Token" value="token-usdc" tokens={tokens} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /USDC/i }));
    fireEvent.click(screen.getAllByRole('option', { name: /EURC/i })[0]);

    expect(onChange).toHaveBeenCalledWith('token-eurc');
  });

  test('shows disabled tokens greyed out with an unavailable tooltip', () => {
    const onChange = vi.fn();
    render(<TokenSelector label="Token" value="token-usdc" tokens={tokens} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /USDC/i }));
    const xlmOption = screen.getAllByRole('option', { name: /XLM/i })[0];

    expect(xlmOption).toHaveAttribute('aria-disabled', 'true');
    expect(xlmOption).toHaveAttribute('title', 'XLM is not in the current invoice allowlist.');
    expect(xlmOption).toHaveClass('cursor-not-allowed');

    fireEvent.click(xlmOption);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('defaults display to USDC when no value is provided', () => {
    render(<TokenSelector label="Token" value="" tokens={tokens} />);

    const trigger = screen.getByRole('button', { name: /USDC/i });
    expect(within(trigger).getByText('USD Coin')).toBeInTheDocument();
  });
});
