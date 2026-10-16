import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LPDashboard from '@/components/LPDashboard';

const approvedTokens = [
  { contractId: 'token-usdc', name: 'USD Coin', symbol: 'USDC', decimals: 7, iconLabel: 'US' },
  { contractId: 'token-eurc', name: 'Euro Coin', symbol: 'EURC', decimals: 7, iconLabel: 'EU' },
];

const mockInvoice = {
  id: 1n,
  freelancer: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  payer: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBRY',
  amount: 1_000_000_000n,
  due_date: 1_900_000_000n,
  discount_rate: 300,
  status: 'Pending',
  token: 'token-usdc',
};

const getAllInvoices = vi.fn();
const getUsdcAllowance = vi.fn();

// LPDashboard reads its rows through useInvoices (react-query).
vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => ({
    data: [mockInvoice],
    isLoading: false,
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  }),
  useFundInvoice: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6',
    isConnected: true,
    connect: vi.fn(),
    signTx: vi.fn(),
  }),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    addToast: vi.fn(() => 'toast-id'),
    updateToast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({
    tokens: approvedTokens,
    tokenMap: new Map(approvedTokens.map((token) => [token.contractId, token])),
    defaultToken: approvedTokens[0],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/utils/soroban', () => ({
  getInsurancePoolInfo: vi.fn(async () => null),
  isEnrolledInInsurance: vi.fn(async () => false),
  getAllInvoices: (...args: unknown[]) => getAllInvoices(...args),
  getTokenAllowance: (...args: unknown[]) => getUsdcAllowance(...args),
  buildApproveTokenTransaction: vi.fn(),
  fundInvoice: vi.fn(),
  submitSignedTransaction: vi.fn(),
  getPayerScoresBatch: vi.fn(async () => new Map()),
}));

describe('LPDashboard approval flow', () => {
  beforeEach(() => {
    getAllInvoices.mockReset();
    getUsdcAllowance.mockReset();
    getAllInvoices.mockResolvedValue([mockInvoice]);
  });

  it('skips step 1 when allowance is already sufficient', async () => {
    getUsdcAllowance.mockResolvedValue(1_000_000_000n);

    render(<LPDashboard />);

    fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));

    await waitFor(() => {
      expect(screen.getByText('Allowance Sufficient')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Fund Invoice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fund Invoice' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve USDC' })).not.toBeInTheDocument();
  });

  it('shows step 1 when allowance is insufficient', async () => {
    getUsdcAllowance.mockResolvedValue(0n);

    render(<LPDashboard />);

    fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Approve USDC' })).toBeInTheDocument();
    });

    expect(screen.getByText('1 of 2')).toBeInTheDocument();

    // The heading renders immediately via a fallback token symbol, before the
    // mocked allowance check resolves - the paragraph below it still reads
    // "Checking current allowance..." until isCheckingAllowance flips false.
    // Wait for the real copy rather than asserting right after the heading.
    await waitFor(() => {
      expect(
        screen.getByText(/You're authorising ILN to spend 100 USDC from your wallet/)
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Approve USDC' })).toBeInTheDocument();
  });
});
