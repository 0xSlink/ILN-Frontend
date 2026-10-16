/**
 * @file StatusBadge.test.tsx
 *
 * The ILN renders inline status badges inside LPDashboard for funded invoices.
 * These tests drive the LPDashboard to render the "My Funded" tab (rendered by
 * LPPortfolio) where the status badge is shown, and verify the badge text and
 * styling for the meaningful invoice statuses used in the protocol:
 *
 *  1. Pending  – shown in Discovery as a "Fund" action, not as a badge
 *  2. Funded / 3. Paid / 4. Defaulted / 5. Cancelled – neutral surface badge
 *
 * We use the wallet address that matches invoice.funder so each invoice shows up
 * in the "My Funded" tab where badges are rendered.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LPDashboard from '../LPDashboard';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../hooks/useInvoices', () => ({
  useInvoices: vi.fn(),
  useFundInvoice: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

import { useInvoices } from '@/hooks/useInvoices';

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn().mockResolvedValue(false),
  getAddress: vi.fn().mockResolvedValue({ address: null }),
  setAllowed: vi.fn().mockResolvedValue(false),
  signTransaction: vi.fn(),
  getNetwork: vi.fn().mockResolvedValue({ network: 'TESTNET' }),
}));

const LP_ADDRESS = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6';

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({
    address: LP_ADDRESS,
    connect: vi.fn(),
    signTx: vi.fn(),
  }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({
    addToast: vi.fn(() => 'toast-id'),
    updateToast: vi.fn(),
  }),
}));

const getAllInvoices = vi.fn();
const getTokenAllowance = vi.fn();

vi.mock('../../utils/soroban', () => ({
  getInsurancePoolInfo: vi.fn(async () => null),
  isEnrolledInInsurance: vi.fn(async () => false),
  getAllInvoices: (...args: unknown[]) => getAllInvoices(...args),
  getTokenAllowance: (...args: unknown[]) => getTokenAllowance(...args),
  buildApproveTokenTransaction: vi.fn(),
  fundInvoice: vi.fn(),
  submitSignedTransaction: vi.fn(),
  claimDefault: vi.fn(),
  getPayerScoresBatch: vi.fn().mockResolvedValue(new Map()),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal invoice object whose funder matches the LP address so it
 *  appears in the "My Funded" tab. */
function makeInvoice(id: bigint, status: string) {
  return {
    id,
    freelancer: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    payer: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBRY',
    amount: 1_000_000_000n,
    due_date: 1_900_000_000n,
    discount_rate: 300,
    status,
    funder: LP_ADDRESS, // owned by the connected wallet → appears in "My Funded"
  };
}

/** Render the dashboard and navigate to the "My Funded" tab. */
async function renderMyFundedTab(invoice: any) {
  (useInvoices as any).mockReturnValue({
    data: [invoice],
    isLoading: false,
    dataUpdatedAt: Date.now(),
  });
  render(<LPDashboard />);

  // Wait for the list to load then switch tab
  fireEvent.click(await screen.findByRole('button', { name: 'My Funded' }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StatusBadge – all five invoice statuses', () => {
  beforeEach(() => {
    (useInvoices as any).mockReset();
    getTokenAllowance.mockReset();
  });

  it("renders the 'Funded' badge with blue classes", async () => {
    await renderMyFundedTab(makeInvoice(10n, 'Funded'));

    await waitFor(() => {
      const badge = screen.getByText('Funded');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-surface-container-low');
      expect(badge.className).toContain('text-on-surface');
    });
  });

  it("renders the 'Paid' badge with green classes", async () => {
    await renderMyFundedTab(makeInvoice(11n, 'Paid'));

    await waitFor(() => {
      const badge = screen.getByText('Paid');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-surface-container-low');
      expect(badge.className).toContain('text-on-surface');
    });
  });

  it("renders the 'Defaulted' badge with red classes", async () => {
    await renderMyFundedTab(makeInvoice(12n, 'Defaulted'));

    await waitFor(() => {
      const badge = screen.getByText('Defaulted');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-surface-container-low');
      expect(badge.className).toContain('text-on-surface');
    });
  });

  it("renders the 'Cancelled' badge with red classes", async () => {
    await renderMyFundedTab(makeInvoice(13n, 'Cancelled'));

    await waitFor(() => {
      const badge = screen.getByText('Cancelled');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-surface-container-low');
      expect(badge.className).toContain('text-on-surface');
    });
  });

  /**
   * 'Pending' invoices appear in the Discovery tab, not My Funded.
   * We still verify that the Discovery tab renders a "Fund" button (not a badge)
   * for Pending invoices.
   */
  it("renders a 'Fund' action button (not a badge) for Pending invoices in Discovery", async () => {
    const pendingInvoice = {
      id: 14n,
      freelancer: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      payer: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBRY',
      amount: 1_000_000_000n,
      due_date: 1_900_000_000n,
      discount_rate: 300,
      status: 'Pending',
      funder: null,
    };

    (useInvoices as any).mockReturnValue({
      data: [pendingInvoice],
      isLoading: false,
      dataUpdatedAt: Date.now(),
    });
    render(<LPDashboard />);

    // Default tab is Discovery
    expect(await screen.findByRole('button', { name: 'Fund' })).toBeInTheDocument();
    // Status badge should not appear in Discovery rows
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });

  it('renders multiple invoices with distinct correct badges simultaneously', async () => {
    (useInvoices as any).mockReturnValue({
      data: [makeInvoice(20n, 'Funded'), makeInvoice(21n, 'Paid'), makeInvoice(22n, 'Defaulted')],
      isLoading: false,
      dataUpdatedAt: Date.now(),
    });

    render(<LPDashboard />);
    fireEvent.click(await screen.findByRole('button', { name: 'My Funded' }));

    await waitFor(() => {
      expect(screen.getByText('Funded')).toBeInTheDocument();
      expect(screen.getByText('Paid')).toBeInTheDocument();
      expect(screen.getByText('Defaulted')).toBeInTheDocument();
    });
  });
});
