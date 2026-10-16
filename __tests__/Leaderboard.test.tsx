import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import LeaderboardPage from '../app/leaderboard/page';

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GABCDEF1234567890ABCDEF1234567890ABCDEF12',
    isConnected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    networkMismatch: false,
    error: null,
    signTx: vi.fn(),
  }),
}));

vi.mock('@/utils/soroban', () => ({
  getTopPayers: vi.fn(async () => [
    {
      address: 'GABCDEF1234567890ABCDEF1234567890ABCDEF12',
      score: 820,
      invoices_paid: 34,
      invoices_defaulted: 1,
      total_volume: 120000000n,
    },
    {
      address: 'GHIJKL9876543210GHIJKL9876543210GHIJKL98',
      score: 712,
      invoices_paid: 27,
      invoices_defaulted: 0,
      total_volume: 90000000n,
    },
  ]),
  getTopFreelancers: vi.fn(async () => [
    {
      address: 'GFREE1234567890FREE1234567890FREE1234567',
      score: 640,
      invoices_submitted: 18,
      invoices_funded: 15,
      total_earned: 45000000n,
    },
  ]),
  getTopLPs: vi.fn(async () => [
    {
      address: 'GLP1234567890LP1234567890LP1234567890LP1',
      score: 590,
      liquidity_provided: 250000000n,
      fees_earned: 3000000n,
      total_funded: 9,
    },
  ]),
}));

vi.mock('@/utils/federation', () => ({
  resolveFederatedAddress: vi.fn(async (address: string) => address),
}));

describe('Leaderboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://example.com/leaderboard',
      },
      writable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
    });
  });

  it('renders leaderboard rows and highlights connected wallet row', async () => {
    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Top Payers' })).toBeInTheDocument();
    });

    expect(screen.getByText('820')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('120 USDC')).toBeInTheDocument();

    const highlightedRow = screen.getByTestId('leaderboard-user-row');
    expect(highlightedRow).toBeInTheDocument();
    expect(highlightedRow).toHaveTextContent('Your wallet');
    expect(within(highlightedRow).getByText('820')).toBeInTheDocument();
    expect(within(highlightedRow).getByText('120 USDC')).toBeInTheDocument();
  });

  it('copies the leaderboard URL when the share button is clicked', async () => {
    render(<LeaderboardPage />);

    const shareButton = screen.getByRole('button', { name: /share leaderboard/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/leaderboard');
    });

    // setCopied(true) fires in the microtask after the clipboard write
    // resolves, not synchronously with the call - wait for the label
    // itself rather than assuming it's already rendered once writeText
    // has been called (otherwise this races the state update).
    await waitFor(() => {
      expect(screen.getByText(/link copied/i)).toBeInTheDocument();
    });
  });
});
