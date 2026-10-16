import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import FundConfirmModal from '../FundConfirmModal';
import LPEarningsHistory from '../LPEarningsHistory';
import StatsMetricCards from '../stats/StatsMetricCards';

// Mocking necessary hooks and contexts
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GABC123',
    signTx: vi.fn(),
  }),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn(), updateToast: vi.fn() }),
}));

vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: () => ({
    execute: vi.fn(),
    loading: false,
    error: null,
    signingModal: null,
  }),
}));

vi.mock('@/hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({
    tokens: [],
    tokenMap: new Map([['USDC', { symbol: 'USDC', contractId: 'USDC', decimals: 6 }]]),
    defaultToken: { symbol: 'USDC', contractId: 'USDC', decimals: 6 },
  }),
}));

vi.mock('@/utils/governance', () => ({
  fetchProtocolParameters: vi.fn(),
}));

vi.mock('@/utils/soroban', () => ({
  getTokenAllowance: vi.fn(),
}));

import { fetchProtocolParameters } from '@/utils/governance';
import { getTokenAllowance } from '@/utils/soroban';

const mockInvoice = {
  id: 1n,
  token: 'USDC',
  amount: 1000_000000n, // 1000 USDC
  discount_rate: 500, // 5%
  due_date: 2000000000n,
  status: 'Pending',
  payer: 'GPAYER',
  freelancer: 'GFREELANCER',
  funder: null,
};

describe('Protocol Fee Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FundConfirmModal', () => {
    it('renders protocol fee when fee is non-zero in Step 2', async () => {
      (fetchProtocolParameters as any).mockResolvedValue({ feeRateBps: 50 }); // 0.5%
      (getTokenAllowance as any).mockResolvedValue(1000_000000n); // sufficient allowance to go to step 2

      render(
        <FundConfirmModal invoice={mockInvoice as any} onClose={vi.fn()} onSuccess={vi.fn()} />
      );

      // Fee display should eventually appear in step 2 (Review)
      const feeLabel = await screen.findByText(/Protocol fee \(50 bps\):/i);
      expect(feeLabel).toBeInTheDocument();
      // 1000 * 5% = 50. 50 * 0.5% = 0.25.
      expect(screen.getByText(/≈ 0\.25/i)).toBeInTheDocument();
    });

    it('renders 0% fee badge when fee is zero in Step 2', async () => {
      (fetchProtocolParameters as any).mockResolvedValue({ feeRateBps: 0 });
      (getTokenAllowance as any).mockResolvedValue(1000_000000n);

      render(
        <FundConfirmModal invoice={mockInvoice as any} onClose={vi.fn()} onSuccess={vi.fn()} />
      );

      const feeBadge = await screen.findByText(/0% Protocol Fee/i);
      expect(feeBadge).toBeInTheDocument();
    });
  });

  describe('LPEarningsHistory', () => {
    it('renders Fee Paid column and 0% badge when fee is zero', async () => {
      (fetchProtocolParameters as any).mockResolvedValue({ feeRateBps: 0 });

      render(
        <LPEarningsHistory
          invoices={
            [{ ...mockInvoice, status: 'Paid', funder: 'GWALLET', funded_at: 1600000000n }] as any
          }
          tokenMap={new Map([['USDC', { symbol: 'USDC', contractId: 'USDC', decimals: 6 }]])}
          walletAddress="GWALLET"
        />
      );

      expect(screen.getByText(/Fee Paid/i)).toBeInTheDocument();
      const zeroFeeBadge = await screen.findByText(/0% Fee/i);
      expect(zeroFeeBadge).toBeInTheDocument();
    });
  });

  describe('StatsMetricCards', () => {
    it('renders protocol fees metric with tooltip and badge', () => {
      const stats = {
        total_invoices: 10,
        total_funded: 5,
        total_paid: 2,
        total_volume_usd: 5000,
        total_protocol_fees_usd: 12.5,
        feeRateBps: 50,
        volume_by_token: [],
        daily_volume: [],
      };

      render(<StatsMetricCards stats={stats as any} />);

      expect(screen.getByText(/Protocol Fees Collected/i)).toBeInTheDocument();
      expect(screen.getByText(/\$12\.5/i)).toBeInTheDocument();
    });

    it('renders 0% fee badge on stats when fee is zero', () => {
      const stats = {
        total_invoices: 10,
        total_funded: 5,
        total_paid: 2,
        total_volume_usd: 5000,
        total_protocol_fees_usd: 0,
        feeRateBps: 0,
        volume_by_token: [],
        daily_volume: [],
      };

      render(<StatsMetricCards stats={stats as any} />);

      expect(screen.getByText(/0% FEE/i)).toBeInTheDocument();
    });
  });
});
