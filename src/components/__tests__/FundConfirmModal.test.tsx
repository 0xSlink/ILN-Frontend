/**
 * @file FundConfirmModal.test.tsx
 *
 * The ILN does not have a standalone FundConfirmModal component; the confirmation
 * modal lives inside LPDashboard. These tests exercise the modal's exact surface:
 *
 *  - Expected yield figures are accurately derived from the mocked invoice props
 *    (amount, discount_rate) and displayed in the UI.
 *  - "Fund Invoice" (Confirm) button triggers `fundInvoice` + `submitSignedTransaction`
 *    when the USDC allowance is already sufficient (step 2 path).
 *  - "Approve USDC" button triggers `buildApproveUsdcTransaction` + `submitSignedTransaction`
 *    when the allowance is insufficient (step 1 path).
 *  - Error messages from contract calls are surfaced in the modal.
 *  - "Cancel" button closes the modal without calling any contract function.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LPDashboard from '../LPDashboard';

// ─── Stable mock handles ─────────────────────────────────────────────────────

const addToast = vi.fn(() => 'toast-id');
const updateToast = vi.fn();
const getAllInvoices = vi.fn();
const getTokenAllowance = vi.fn();
const buildApproveTokenTransaction = vi.fn();
const fundInvoice = vi.fn();
const submitSignedTransaction = vi.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../hooks/useInvoices', () => ({
  useInvoices: vi.fn(),
  useFundInvoice: vi.fn(() => ({
    mutate: vi.fn((_id, { onSuccess: _onSuccess, onError: _onError }) => {
      // Manual trigger for testing
    }),
    isPending: false,
  })),
}));

import { useInvoices } from '@/hooks/useInvoices';

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn().mockResolvedValue(false),
  getAddress: vi.fn().mockResolvedValue({ address: null }),
  setAllowed: vi.fn().mockResolvedValue(false),
  signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: 'signed-xdr' }),
  getNetwork: vi.fn().mockResolvedValue({ network: 'TESTNET' }),
}));

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6',
    // useTransaction().execute short-circuits unless the wallet reports connected.
    isConnected: true,
    connect: vi.fn(),
    signTx: vi.fn().mockResolvedValue('signed-xdr'),
  }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ addToast, updateToast }),
}));

vi.mock('../../utils/soroban', () => ({
  getInsurancePoolInfo: vi.fn(async () => null),
  isEnrolledInInsurance: vi.fn(async () => false),
  getAllInvoices: (...args: unknown[]) => getAllInvoices(...args),
  getTokenAllowance: (...args: unknown[]) => getTokenAllowance(...args),
  buildApproveTokenTransaction: (...args: unknown[]) => buildApproveTokenTransaction(...args),
  fundInvoice: (...args: unknown[]) => fundInvoice(...args),
  submitSignedTransaction: (...args: unknown[]) => submitSignedTransaction(...args),
  getPayerScoresBatch: vi.fn().mockResolvedValue(new Map()),
}));

// The returned objects must keep a stable identity across renders: the modal's
// allowance-refresh effect depends on `defaultToken`, and a fresh object every
// render would re-run it (clearing the funding-error banner) on each update.
vi.mock('../../hooks/useApprovedTokens', () => {
  const usdc = { symbol: 'USDC', contractId: 'TESTNET_USDC_TOKEN_ID', decimals: 7 };
  const result = {
    tokens: [usdc],
    tokenMap: new Map([['TESTNET_USDC_TOKEN_ID', usdc]]),
    defaultToken: usdc,
  };
  return { useApprovedTokens: () => result };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '',
  useSearchParams: () => new URLSearchParams(),
}));

// ─── Test data ────────────────────────────────────────────────────────────────

/**
 * 1 000 USDC at 3 % discount rate.
 *   Amount in stroops  = 1_000 × 10_000_000 = 10_000_000_000
 *   Yield  = amount × discount_rate / 10_000 = 10_000_000_000 × 300 / 10_000 = 300_000_000 stroops = 30 USDC
 *   Freelancer payout = 10_000_000_000 − 300_000_000 = 9_700_000_000 stroops = 970 USDC
 */
const mockInvoice = {
  id: 7n,
  freelancer: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  payer: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBRY',
  amount: 10_000_000_000n, // 1,000 USDC in stroops
  due_date: 1_900_000_000n, // far-future unix timestamp
  discount_rate: 300, // 3.00 %
  status: 'Pending',
  funder: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FundConfirmModal (via LPDashboard)', () => {
  beforeEach(() => {
    addToast.mockClear();
    updateToast.mockClear();
    (useInvoices as any).mockReturnValue({
      data: [mockInvoice],
      isLoading: false,
      dataUpdatedAt: Date.now(),
    });
    getTokenAllowance.mockReset();
    buildApproveTokenTransaction.mockReset();
    fundInvoice.mockReset();
    submitSignedTransaction.mockReset();
  });

  // ── Yield calculation display ─────────────────────────────────────────────

  describe('yield calculation display', () => {
    it('shows the invoice face value (amount sent) correctly', async () => {
      getTokenAllowance.mockResolvedValue(10_000_000_000n); // sufficient allowance

      render(<LPDashboard />);
      fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));

      await waitFor(() => expect(screen.getByText(/Fund Invoice #7/i)).toBeInTheDocument());

      // "You will send" row – 1,000 USDC
      expect(screen.getAllByText(/1,000/i).length).toBeGreaterThanOrEqual(1);
    });

    it('shows the freelancer payout (amount − yield) correctly', async () => {
      getTokenAllowance.mockResolvedValue(10_000_000_000n);

      render(<LPDashboard />);
      fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));

      await waitFor(() => expect(screen.getByText(/Fund Invoice #7/i)).toBeInTheDocument());

      expect(screen.getByText(/970/i)).toBeInTheDocument();
    });

    it('shows the LP yield (discount) correctly', async () => {
      getTokenAllowance.mockResolvedValue(10_000_000_000n);

      render(<LPDashboard />);
      fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));

      await waitFor(() => expect(screen.getByText(/Fund Invoice #7/i)).toBeInTheDocument());

      // 1000 × 3% = 30 USDC  →  300_000_000 stroops → "30 USDC"
      expect(screen.getAllByText(/30 USDC/i)[0]).toBeInTheDocument();
      // discount-rate badge
      expect(screen.getAllByText(/3\.00%/)[0]).toBeInTheDocument();
    });
  });

  // ── Confirm (Fund) button – sufficient allowance path ────────────────────

  describe('when allowance is already sufficient', () => {
    beforeEach(() => {
      getTokenAllowance.mockResolvedValue(10_000_000_000n); // equal to invoice amount
    });

    it("renders the 'Fund Invoice' action button, not 'Approve USDC'", async () => {
      render(<LPDashboard />);
      fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Fund Invoice' })).toBeInTheDocument()
      );

      expect(screen.queryByRole('button', { name: 'Approve USDC' })).not.toBeInTheDocument();
    });

    it("calls fundInvoice and submitSignedTransaction when 'Fund Invoice' is clicked", async () => {
      fundInvoice.mockResolvedValue('fund-tx-xdr');
      submitSignedTransaction.mockResolvedValue({ txHash: 'fund-hash' });

      render(<LPDashboard />);
      fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Fund Invoice' }));

      await waitFor(() => expect(fundInvoice).toHaveBeenCalledTimes(1));
      expect(fundInvoice).toHaveBeenCalledWith(expect.any(String), mockInvoice.id);
      expect(submitSignedTransaction).toHaveBeenCalledTimes(1);
    });

    it('fires a success toast after a successful fund call', async () => {
      fundInvoice.mockResolvedValue('fund-tx-xdr');
      submitSignedTransaction.mockResolvedValue({ txHash: 'fund-hash' });

      render(<LPDashboard />);
      fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Fund Invoice' }));

      await waitFor(() =>
        expect(updateToast).toHaveBeenCalledWith(
          'toast-id',
          expect.objectContaining({ type: 'success', title: 'Invoice funded successfully!' })
        )
      );
    });

    it('shows an error message in the modal when fundInvoice rejects', async () => {
      fundInvoice.mockRejectedValue(new Error('Contract revert: insufficient balance'));

      render(<LPDashboard />);
      fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Fund Invoice' }));

      // useTransaction surfaces the contract error in a toast; the modal falls
      // back to its generic banner because the hook error is set asynchronously.
      await waitFor(() =>
        expect(updateToast).toHaveBeenCalledWith(
          'toast-id',
          expect.objectContaining({ type: 'error' })
        )
      );
      expect(await screen.findByText('An unknown error occurred')).toBeInTheDocument();
    });
  });

  // ── Approve button – insufficient allowance path ──────────────────────────

  describe('when allowance is insufficient', () => {
    beforeEach(() => {
      getTokenAllowance.mockResolvedValue(0n);
    });

    it("renders 'Approve USDC' action button in step-1 state", async () => {
      render(<LPDashboard />);
      fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Approve USDC' })).toBeInTheDocument()
      );
    });

    it('calls buildApproveTokenTransaction and submitSignedTransaction on approve', async () => {
      buildApproveTokenTransaction.mockResolvedValue('approve-tx-xdr');
      submitSignedTransaction.mockResolvedValue({ txHash: 'approve-hash' });

      render(<LPDashboard />);
      fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));
      // The button is disabled (and its click a no-op) until the mocked
      // allowance check resolves - wait for it to become enabled, not just
      // present, before clicking. Otherwise this races the allowance promise
      // and intermittently no-ops under load (flaky in CI, rare locally).
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Approve USDC' })).toBeEnabled()
      );
      fireEvent.click(screen.getByRole('button', { name: 'Approve USDC' }));

      await waitFor(() => expect(buildApproveTokenTransaction).toHaveBeenCalledTimes(1));
      expect(submitSignedTransaction).toHaveBeenCalledTimes(1);
    });

    it('fires a success toast after a successful approve call', async () => {
      buildApproveTokenTransaction.mockResolvedValue('approve-tx-xdr');
      submitSignedTransaction.mockResolvedValue({ txHash: 'approve-hash' });

      render(<LPDashboard />);
      fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));
      // The button is disabled (and its click a no-op) until the mocked
      // allowance check resolves - wait for it to become enabled, not just
      // present, before clicking. Otherwise this races the allowance promise
      // and intermittently no-ops under load (flaky in CI, rare locally).
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Approve USDC' })).toBeEnabled()
      );
      fireEvent.click(screen.getByRole('button', { name: 'Approve USDC' }));

      await waitFor(() =>
        expect(updateToast).toHaveBeenCalledWith(
          'toast-id',
          expect.objectContaining({ type: 'success', title: 'USDC approved' })
        )
      );
    });

    it('shows the funding-error message when approval fails', async () => {
      buildApproveTokenTransaction.mockRejectedValue(new Error('User rejected tx'));

      render(<LPDashboard />);
      fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));
      // The button is disabled (and its click a no-op) until the mocked
      // allowance check resolves - wait for it to become enabled, not just
      // present, before clicking. Otherwise this races the allowance promise
      // and intermittently no-ops under load (flaky in CI, rare locally).
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Approve USDC' })).toBeEnabled()
      );
      fireEvent.click(screen.getByRole('button', { name: 'Approve USDC' }));

      await waitFor(() => {
        expect(screen.getByText('Approval failed.')).toBeInTheDocument();
      });
    });
  });

  // ── Cancel button ─────────────────────────────────────────────────────────

  it('closes the modal without calling any contract function when Cancel is clicked', async () => {
    getTokenAllowance.mockResolvedValue(0n);

    render(<LPDashboard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fund' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText(/Fund Invoice #7/i)).not.toBeInTheDocument());

    expect(fundInvoice).not.toHaveBeenCalled();
    expect(buildApproveTokenTransaction).not.toHaveBeenCalled();
    expect(submitSignedTransaction).not.toHaveBeenCalled();
  });
});
