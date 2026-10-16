/**
 * Interaction coverage for LPDashboard's own logic - tabs, sorting, row
 * selection/compare, watchlist toggling, keyboard navigation, risk
 * filtering, claim handlers, the reputation override ("Fund Anyway"),
 * onboarding, and the widget layout manager.
 *
 * Every non-trivial child component is stubbed out so failures here point
 * at LPDashboard's own state machine rather than a child's rendering
 * details - those are covered by their own component test files.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LPDashboard from '@/components/LPDashboard';

const ADDR_LP = 'GLPLPLPLPLPLPLPLPLPLPLPLPLPLPLPLPLPLPLPLPLPLPLPLPLPLPL7Y';
const ADDR_FREELANCER = 'GFREELANCERFREELANCERFREELANCERFREELANCERFREELANCERQ2K';
const ADDR_PAYER = 'GPAYERPAYERPAYERPAYERPAYERPAYERPAYERPAYERPAYERPAYERZDS';

const approvedTokens = [
  { contractId: 'token-usdc', name: 'USD Coin', symbol: 'USDC', decimals: 7, iconLabel: 'US' },
];

function pendingInvoice(id: bigint, amount: bigint) {
  return {
    id,
    freelancer: ADDR_FREELANCER,
    payer: ADDR_PAYER,
    amount,
    due_date: 1_900_000_000n,
    discount_rate: 300,
    status: 'Pending' as const,
    token: 'token-usdc',
  };
}

const invoiceA = pendingInvoice(1n, 1_000_000_000n);
const invoiceB = pendingInvoice(2n, 2_000_000_000n);
const invoiceC = pendingInvoice(3n, 3_000_000_000n);
const invoiceD = pendingInvoice(4n, 4_000_000_000n);

const fundedSafe = {
  id: 10n,
  freelancer: ADDR_FREELANCER,
  payer: ADDR_PAYER,
  amount: 1_000_000_000n,
  due_date: 1_900_000_000n,
  discount_rate: 300,
  status: 'Funded' as const,
  funder: ADDR_LP,
  token: 'token-usdc',
};

const fundedAtRisk = {
  ...fundedSafe,
  id: 11n,
  due_date: BigInt(Math.floor((Date.now() + 12 * 60 * 60 * 1000) / 1000)),
};

const fundedDisputed = {
  ...fundedSafe,
  id: 12n,
  status: 'Disputed' as const,
};

const watchlistFundedSelfPayer = {
  ...fundedSafe,
  id: 20n,
  payer: ADDR_LP,
};

const walletState = {
  address: ADDR_LP as string | null,
  isConnected: true,
  connect: vi.fn(),
  signTx: vi.fn(),
};

const invoicesState = {
  data: [invoiceA, invoiceB, invoiceC, invoiceD] as any[],
  isLoading: false,
  dataUpdatedAt: Date.now(),
  refetch: vi.fn(),
};

const watchlistState = {
  watchlist: [] as { id: string; addedAt: number }[],
};

const toggleWatchlistMock = vi.fn();
const isInWatchlistMock = vi.fn(() => false);

const payerScoresState = new Map<string, { score: number } | null>();
const lpSettingsState = { minReputation: 0 };

const addToastMock = vi.fn();
const setFiltersMock = vi.fn();
const pushMock = vi.fn();
const executeMock = vi.fn(async (op: any) => {
  await op(vi.fn(async () => 'signed-xdr'));
  return 'ok';
});

const claimDefaultMock = vi.fn(async () => 'claim-default-xdr');
const claimInsuranceMock = vi.fn(async () => 'claim-insurance-xdr');
const submitSignedTransactionMock = vi.fn(async () => ({ txHash: 'hash123' }));
const getTokenAllowanceMock = vi.fn(async () => 0n);

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock, updateToast: vi.fn() }),
}));

vi.mock('@/hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({
    tokens: approvedTokens,
    tokenMap: new Map(approvedTokens.map((t) => [t.contractId, t])),
    defaultToken: approvedTokens[0],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => invoicesState,
}));

vi.mock('@/hooks/useInvoiceFilters', () => ({
  useInvoiceFilters: () => ({
    filters: {
      search: '',
      statuses: [],
      minAmount: '',
      maxAmount: '',
      startDate: '',
      endDate: '',
      dateType: 'due',
      token: '',
      minDiscountBps: '',
      maxDiscountBps: '',
      minPayerReputation: '',
    },
    setFilters: setFiltersMock,
    clearFilters: vi.fn(),
    activeFilterCount: 0,
  }),
  applyInvoiceFilters: (invoices: any[]) => invoices,
}));

vi.mock('@/hooks/useWatchlist', () => ({
  useWatchlist: () => ({
    watchlist: watchlistState.watchlist,
    toggleWatchlist: toggleWatchlistMock,
    isInWatchlist: isInWatchlistMock,
  }),
}));

vi.mock('@/hooks/usePayerScores', () => ({
  usePayerScores: () => ({ scores: payerScoresState, risks: new Map() }),
}));

vi.mock('@/hooks/useLPSettings', () => ({
  useLPSettings: () => ({ settings: lpSettingsState }),
}));

vi.mock('@/hooks/useLPWidgetLayout', () => ({
  useLPWidgetLayout: () => {
    const widgets = [
      { id: 'portfolio-summary', label: 'Portfolio Summary', visible: true, order: 0 },
      { id: 'analytics-chart', label: 'Analytics Chart', visible: true, order: 1 },
      { id: 'yield-comparison', label: 'Yield Comparison', visible: true, order: 2 },
      { id: 'risk-summary', label: 'Risk Summary', visible: true, order: 3 },
      { id: 'insurance-pool', label: 'Insurance Pool', visible: true, order: 4 },
      { id: 'portfolio-table', label: 'Portfolio Table', visible: true, order: 5 },
    ];
    return {
      widgets,
      visibleWidgets: widgets,
      toggleWidget: vi.fn(),
      reorderWidgets: vi.fn(),
      resetLayout: vi.fn(),
      isLoaded: true,
    };
  },
}));

vi.mock('@/hooks/useInsurance', () => ({
  useInsurance: () => ({ isEnrolled: false }),
}));

vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: () => ({ execute: executeMock, signingModal: null }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/utils/soroban', () => ({
  claimDefault: (...args: unknown[]) => claimDefaultMock(...args),
  claimInsurance: (...args: unknown[]) => claimInsuranceMock(...args),
  submitSignedTransaction: (...args: unknown[]) => submitSignedTransactionMock(...args),
  getTokenAllowance: (...args: unknown[]) => getTokenAllowanceMock(...args),
}));

vi.mock('@/components/InvoiceFilterBar', () => ({
  default: () => <div data-testid="invoice-filter-bar" />,
}));

vi.mock('@/components/LPRiskSummaryPanel', () => ({
  default: ({ onFilterByRisk }: any) => (
    <div data-testid="risk-summary-panel">
      <button onClick={() => onFilterByRisk('at-risk')}>Filter At Risk</button>
      <button onClick={() => onFilterByRisk('disputed')}>Filter Disputed</button>
    </div>
  ),
}));

vi.mock('@/components/LPPortfolio', () => ({
  default: ({ invoices, onClaimDefault, onClaimInsurance, onTransfer }: any) => (
    <div data-testid="lp-portfolio">
      {invoices.map((inv: any) => (
        <div key={inv.id.toString()}>
          <span>Portfolio #{inv.id.toString()}</span>
          <button onClick={() => onClaimDefault(inv)}>Claim Default {inv.id.toString()}</button>
          <button onClick={() => onClaimInsurance(inv)}>Claim Insurance {inv.id.toString()}</button>
          <button onClick={() => onTransfer(inv)}>Transfer {inv.id.toString()}</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/LPPortfolioSummary', () => ({
  default: () => <div data-testid="portfolio-summary" />,
}));

vi.mock('@/components/DynamicYieldAnalyticsChart', () => ({
  default: () => <div data-testid="yield-analytics-chart" />,
}));

vi.mock('@/components/LPYieldComparison', () => ({
  default: () => <div data-testid="yield-comparison" />,
}));

vi.mock('@/components/InsurancePoolPanel', () => ({
  default: () => <div data-testid="insurance-pool-panel" />,
}));

vi.mock('@/components/YieldCalculator', () => ({
  default: ({ onFindMatching }: any) => (
    <button onClick={() => onFindMatching(500, 300)}>Find Matching</button>
  ),
}));

vi.mock('@/components/ExportButton', () => ({
  ExportButton: () => <div data-testid="export-button" />,
}));

vi.mock('@/components/LPEarningsHistory', () => ({
  default: () => <div data-testid="earnings-history-stub" />,
}));

vi.mock('@/components/FundConfirmModal', () => ({
  default: ({ invoice, onClose }: any) =>
    invoice ? (
      <div data-testid="fund-confirm-modal">
        Fund Modal #{invoice.id.toString()}
        <button onClick={onClose}>Close Fund Modal</button>
      </div>
    ) : null,
}));

vi.mock('@/components/DisputeInvoiceModal', () => ({
  default: ({ invoice, onClose }: any) => (
    <div data-testid="dispute-modal">
      Dispute #{invoice.id.toString()}
      <button onClick={onClose}>Close Dispute</button>
    </div>
  ),
}));

vi.mock('@/components/LPTransferModal', () => ({
  default: ({ invoice, onClose }: any) => (
    <div data-testid="transfer-modal">
      Transfer #{invoice.id.toString()}
      <button onClick={onClose}>Close Transfer</button>
    </div>
  ),
}));

vi.mock('@/components/LPOnboardingModal', () => ({
  default: ({ isOpen, onClose, onGoToMarketplace }: any) =>
    isOpen ? (
      <div data-testid="onboarding-modal">
        <button onClick={onClose}>Close Onboarding</button>
        <button onClick={onGoToMarketplace}>Go To Marketplace</button>
      </div>
    ) : null,
}));

vi.mock('@/components/LPWidgetLayoutManager', () => ({
  default: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="widget-layout-manager">
        <button onClick={onClose}>Close Widget Manager</button>
      </div>
    ) : null,
}));

describe('LPDashboard interactions', () => {
  beforeEach(() => {
    walletState.address = ADDR_LP;
    walletState.connect.mockReset();
    walletState.signTx.mockReset();
    invoicesState.data = [invoiceA, invoiceB, invoiceC, invoiceD];
    invoicesState.isLoading = false;
    invoicesState.refetch.mockReset();
    watchlistState.watchlist = [];
    toggleWatchlistMock.mockReset();
    isInWatchlistMock.mockReset();
    isInWatchlistMock.mockReturnValue(false);
    payerScoresState.clear();
    lpSettingsState.minReputation = 0;
    addToastMock.mockReset();
    setFiltersMock.mockReset();
    pushMock.mockReset();
    executeMock.mockClear();
    claimDefaultMock.mockClear();
    claimInsuranceMock.mockClear();
    submitSignedTransactionMock.mockClear();
    getTokenAllowanceMock.mockClear();
    localStorage.clear();
  });

  it('toggles watchlist on and shows a success toast', async () => {
    render(<LPDashboard />);
    // Default sort is amount desc, so invoiceD (highest amount) renders first.
    fireEvent.click((await screen.findAllByTitle('Add to watchlist'))[0]);

    expect(toggleWatchlistMock).toHaveBeenCalledWith(invoiceD.id);
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Added to Watchlist' })
    );
  });

  it('toggles watchlist off and shows a removal toast', async () => {
    isInWatchlistMock.mockReturnValue(true);
    render(<LPDashboard />);
    fireEvent.click((await screen.findAllByTitle('Remove from watchlist'))[0]);

    expect(toggleWatchlistMock).toHaveBeenCalledWith(invoiceD.id);
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Removed from Watchlist' })
    );
  });

  it('shows an error toast when toggling the watchlist throws', async () => {
    toggleWatchlistMock.mockImplementation(() => {
      throw new Error('boom');
    });
    render(<LPDashboard />);
    fireEvent.click((await screen.findAllByTitle('Add to watchlist'))[0]);

    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', title: 'Watchlist Error', message: 'boom' })
    );
  });

  it('enforces the 3-invoice compare selection limit and navigates on compare', async () => {
    render(<LPDashboard />);
    // Rendered row order follows the default amount-desc sort: D, C, B, A.
    const checkboxes = await screen.findAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    expect(screen.getByText('Compare 3 Invoices')).toBeInTheDocument();

    fireEvent.click(checkboxes[3]);
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', title: 'Selection Limit' })
    );
    expect(screen.getByText('Compare 3 Invoices')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Compare 3 Invoices'));
    expect(pushMock).toHaveBeenCalledWith(
      `/lp/compare?ids=${[invoiceD, invoiceC, invoiceB].map((i) => i.id.toString()).join(',')}`
    );
  });

  it('connects the wallet instead of opening the fund modal when disconnected', async () => {
    walletState.address = null;
    render(<LPDashboard />);
    fireEvent.click((await screen.findAllByText('Fund'))[0]);

    expect(walletState.connect).toHaveBeenCalled();
    expect(screen.queryByTestId('fund-confirm-modal')).not.toBeInTheDocument();
  });

  it('opens the fund modal and checks token allowance when connected', async () => {
    render(<LPDashboard />);
    // Default sort is amount desc, so invoiceD's row renders first.
    fireEvent.click((await screen.findAllByText('Fund'))[0]);

    await waitFor(() => {
      expect(screen.getByTestId('fund-confirm-modal')).toHaveTextContent('Fund Modal #4');
    });
    expect(getTokenAllowanceMock).toHaveBeenCalledWith(expect.objectContaining({ owner: ADDR_LP }));
  });

  it('navigates to the invoice detail page on Enter and opens the fund modal on "f"', async () => {
    render(<LPDashboard />);
    // Rendered row order follows the default amount-desc sort: invoiceD first.
    // Row 0 is the header row; data rows start at index 1.
    const rows = await screen.findAllByRole('row');
    fireEvent.keyDown(rows[1], { key: 'Enter' });
    expect(pushMock).toHaveBeenCalledWith('/i/4');

    fireEvent.keyDown(rows[1], { key: 'f' });
    await waitFor(() => {
      expect(screen.getByTestId('fund-confirm-modal')).toBeInTheDocument();
    });
  });

  it('reorders rows when a sortable column header is clicked', async () => {
    render(<LPDashboard />);
    await screen.findByText('#4');

    const rowsBefore = screen.getAllByRole('row').slice(1);
    expect(rowsBefore[0]).toHaveTextContent('#4');

    fireEvent.click(screen.getByRole('columnheader', { name: /Amount/ }));

    const rowsAfter = screen.getAllByRole('row').slice(1);
    expect(rowsAfter[0]).toHaveTextContent('#1');
  });

  it('filters the my-funded portfolio by risk and clears the filter', async () => {
    invoicesState.data = [fundedSafe, fundedAtRisk, fundedDisputed];
    render(<LPDashboard />);

    fireEvent.click(await screen.findByText('My Funded'));
    await screen.findByTestId('lp-portfolio');

    fireEvent.click(screen.getByText('Filter At Risk'));
    await waitFor(() => {
      expect(screen.getByText('Showing at-risk positions only')).toBeInTheDocument();
    });
    expect(screen.getByText('Portfolio #11')).toBeInTheDocument();
    expect(screen.queryByText('Portfolio #10')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear filter'));
    await waitFor(() => {
      expect(screen.getByText('Portfolio #10')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Filter Disputed'));
    await waitFor(() => {
      expect(screen.getByText('Showing disputed positions only')).toBeInTheDocument();
    });
    expect(screen.getByText('Portfolio #12')).toBeInTheDocument();
    expect(screen.queryByText('Portfolio #10')).not.toBeInTheDocument();
  });

  it('claims a default through the transaction executor', async () => {
    invoicesState.data = [fundedSafe];
    render(<LPDashboard />);

    fireEvent.click(await screen.findByText('My Funded'));
    fireEvent.click(await screen.findByText('Claim Default 10'));

    await waitFor(() => {
      expect(executeMock).toHaveBeenCalled();
    });
    expect(claimDefaultMock).toHaveBeenCalledWith(ADDR_LP, fundedSafe.id);
    expect(submitSignedTransactionMock).toHaveBeenCalled();
  });

  it('claims insurance through the transaction executor', async () => {
    invoicesState.data = [fundedSafe];
    render(<LPDashboard />);

    fireEvent.click(await screen.findByText('My Funded'));
    fireEvent.click(await screen.findByText('Claim Insurance 10'));

    await waitFor(() => {
      expect(executeMock).toHaveBeenCalled();
    });
    expect(claimInsuranceMock).toHaveBeenCalledWith(ADDR_LP, fundedSafe.id);
  });

  it('shows Raise Dispute for a self-payer funded invoice on the watchlist tab and opens the modal', async () => {
    invoicesState.data = [watchlistFundedSelfPayer];
    watchlistState.watchlist = [{ id: '20', addedAt: Date.now() }];
    isInWatchlistMock.mockImplementation((id: bigint) => id.toString() === '20');

    render(<LPDashboard />);
    fireEvent.click(await screen.findByText('Watchlist'));

    fireEvent.click(await screen.findByText('Raise Dispute'));
    await waitFor(() => {
      expect(screen.getByTestId('dispute-modal')).toHaveTextContent('Dispute #20');
    });

    fireEvent.click(screen.getByText('Close Dispute'));
    expect(screen.queryByTestId('dispute-modal')).not.toBeInTheDocument();
  });

  it('shows "Fund Anyway" below the reputation threshold and clears it once overridden', async () => {
    invoicesState.data = [invoiceA];
    lpSettingsState.minReputation = 50;
    payerScoresState.set(ADDR_PAYER, { score: 10 });

    render(<LPDashboard />);
    fireEvent.click(await screen.findByText('Fund Anyway'));

    await waitFor(() => {
      expect(screen.queryByText('Fund Anyway')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Fund')).toBeInTheDocument();
  });

  it('shows onboarding for a wallet with no funded invoices and persists dismissal', async () => {
    render(<LPDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Close Onboarding'));
    expect(screen.queryByTestId('onboarding-modal')).not.toBeInTheDocument();
    expect(localStorage.getItem(`iln_lp_onboarding_completed_${ADDR_LP}`)).toBe('true');
  });

  it('routes to the marketplace from the onboarding modal', async () => {
    render(<LPDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Go To Marketplace'));
    expect(pushMock).toHaveBeenCalledWith('/marketplace');
    expect(screen.queryByTestId('onboarding-modal')).not.toBeInTheDocument();
  });

  it('opens and closes the widget layout manager', async () => {
    render(<LPDashboard />);
    fireEvent.click(await screen.findByText('Customize Widgets'));

    expect(screen.getByTestId('widget-layout-manager')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close Widget Manager'));
    expect(screen.queryByTestId('widget-layout-manager')).not.toBeInTheDocument();
  });

  it('applies YieldCalculator matches to the active filters', async () => {
    render(<LPDashboard />);
    fireEvent.click(await screen.findByText('Find Matching'));

    expect(setFiltersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        minAmount: '500',
        minDiscountBps: '300',
        maxDiscountBps: '350',
      })
    );
  });

  it('renders skeleton rows while loading with no invoices yet', () => {
    invoicesState.data = [];
    invoicesState.isLoading = true;
    const { container } = render(<LPDashboard />);

    expect(container.querySelectorAll('tbody tr[aria-hidden="true"]').length).toBe(5);
  });

  it('shows empty state copy for discovery and watchlist tabs', async () => {
    invoicesState.data = [];
    render(<LPDashboard />);

    await screen.findByText('No Pending Invoices');

    fireEvent.click(screen.getByText('Watchlist'));
    await screen.findByText('Watchlist Empty');
  });
});
