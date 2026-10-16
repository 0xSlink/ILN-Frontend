import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LPDashboard from '@/components/LPDashboard';
import { FIXTURE_ADDRESSES, allInvoiceFixtures, invoiceFixtures } from './fixtures/invoices';

const approvedTokens = [
  { contractId: 'token-usdc', name: 'USD Coin', symbol: 'USDC', decimals: 7, iconLabel: 'US' },
  { contractId: 'token-eurc', name: 'Euro Coin', symbol: 'EURC', decimals: 7, iconLabel: 'EU' },
];

const walletState = {
  address: FIXTURE_ADDRESSES.lp,
  isConnected: true,
  isInstalled: true,
  error: null as string | null,
  networkMismatch: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  signTx: vi.fn(),
};

const addToast = vi.fn(() => 'toast-id');
const updateToast = vi.fn();
const getAllInvoices = vi.fn();
const getUsdcAllowance = vi.fn();

// LPDashboard reads its rows through useInvoices (react-query), which the
// global setup mocks to an empty list.
vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => ({
    data: allInvoiceFixtures,
    isLoading: false,
    dataUpdatedAt: 1_700_000_000_000,
    refetch: vi.fn(),
  }),
  useFundInvoice: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    addToast,
    updateToast,
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

vi.mock('@/utils/soroban', async () => {
  const actual = await vi.importActual<typeof import('@/utils/soroban')>('@/utils/soroban');

  return {
    ...actual,
    getInsurancePoolInfo: vi.fn(async () => null),
    isEnrolledInInsurance: vi.fn(async () => false),
    getAllInvoices: (...args: unknown[]) => getAllInvoices(...args),
    getTokenAllowance: (...args: unknown[]) => getUsdcAllowance(...args),
    buildApproveTokenTransaction: vi.fn(),
    fundInvoice: vi.fn(),
    submitSignedTransaction: vi.fn(),
  };
});

describe('LPDashboard snapshots', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    // Several panels derive copy from the current time ("N days ago", "days
    // until due", a wall clock). Pin the clock so the snapshots are stable;
    // shouldAdvanceTime keeps async waits working.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-02T00:00:00.000Z'));
    vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('12:00:00 AM');
    // LastUpdated's "title" tooltip formats dataUpdatedAt via toLocaleString()
    // with no timeZone option, so it renders in the host machine's local
    // timezone - non-deterministic across CI runners and contributors'
    // machines. Pin it, matching UTC (1_700_000_000_000 = Nov 14, 2023,
    // 22:13:20 UTC), same pattern as the toLocaleTimeString mock above.
    vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('Nov 14, 2023, 10:13 PM');
    walletState.address = FIXTURE_ADDRESSES.lp;
    walletState.isConnected = true;
    walletState.networkMismatch = false;
    walletState.connect.mockReset();
    walletState.disconnect.mockReset();
    walletState.signTx.mockReset();
    addToast.mockClear();
    updateToast.mockClear();
    getAllInvoices.mockReset();
    getUsdcAllowance.mockReset();
    getAllInvoices.mockResolvedValue(allInvoiceFixtures);
    getUsdcAllowance.mockResolvedValue(0n);
  });

  it('matches the invoice table discovery state with fixture data', async () => {
    const { asFragment } = render(<LPDashboard />);

    await screen.findByText('LP Dashboard');
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    expect(asFragment()).toMatchSnapshot();
  });

  it('matches the fund confirmation modal with sample values', async () => {
    const { asFragment } = render(<LPDashboard />);

    fireEvent.click(await screen.findByText('Fund'));

    await waitFor(() => {
      expect(screen.getByText('Fund Invoice #1')).toBeInTheDocument();
    });

    expect(asFragment()).toMatchSnapshot();
  });

  it('matches the lp portfolio style my-funded view with mixed invoice outcomes', async () => {
    const { asFragment } = render(<LPDashboard />);

    fireEvent.click(await screen.findByText('My Funded'));

    await waitFor(() => {
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();
      expect(screen.getByText('#4')).toBeInTheDocument();
      expect(screen.getByText('#5')).toBeInTheDocument();
    });
    // The yield chart loads lazily; wait for it so the snapshot is stable.
    await screen.findByText('Yield Analytics');

    expect(screen.queryByText(`#${invoiceFixtures.pending.id.toString()}`)).not.toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders the earnings history tab with export controls', async () => {
    render(<LPDashboard />);

    fireEvent.click((await screen.findAllByText('Earnings History'))[0]);

    await waitFor(() => {
      expect(screen.getAllByText('Earnings History').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
      expect(screen.getByText('Settlement Date')).toBeInTheDocument();
      expect(screen.getByText('#4')).toBeInTheDocument();
    });
  });
});
