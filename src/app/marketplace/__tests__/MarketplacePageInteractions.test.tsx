import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MarketplacePage from '../page';
import type { Invoice } from '@/utils/soroban';

vi.mock('@/hooks/useDocumentTitle', () => ({ useDocumentTitle: () => {} }));

const walletState = { isConnected: true };
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

const refetchMock = vi.fn();
const useInvoicesMock = vi.fn();
vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => useInvoicesMock(),
}));

const tokenMap = new Map([
  [
    'USDC_ID',
    { symbol: 'USDC', decimals: 6, contractId: 'USDC_ID', name: 'USD Coin', iconLabel: 'U' },
  ],
  [
    'EURC_ID',
    { symbol: 'EURC', decimals: 6, contractId: 'EURC_ID', name: 'Euro Coin', iconLabel: 'E' },
  ],
]);
vi.mock('@/hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({ tokenMap, defaultToken: tokenMap.get('USDC_ID') }),
}));

const payerRisks = new Map<string, string>();
vi.mock('@/hooks/usePayerScores', () => ({
  usePayerScores: () => ({ scores: new Map(), risks: payerRisks }),
}));

vi.mock('@/hooks/useLPSettings', () => ({
  useLPSettings: () => ({ settings: { minReputation: 0 } }),
}));

const toggleBookmarkMock = vi.fn();
const bookmarkedIds = new Set<string>();
vi.mock('@/hooks/useBookmarks', () => ({
  useBookmarks: () => ({
    isBookmarked: (id: string) => bookmarkedIds.has(id),
    toggleBookmark: toggleBookmarkMock,
    count: bookmarkedIds.size,
    atLimit: false,
  }),
}));

vi.mock('@/components/Navbar', () => ({ default: () => <nav data-testid="navbar" /> }));
vi.mock('@/components/FundConfirmModal', () => ({
  default: ({ invoice, onClose }: any) =>
    invoice ? (
      <div data-testid="fund-modal">
        Funding #{invoice.id.toString()}
        <button onClick={onClose}>Close Fund Modal</button>
      </div>
    ) : null,
}));
vi.mock('@/components/LPSettingsModal', () => ({
  default: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="settings-modal">
        <button onClick={onClose}>Close Settings</button>
      </div>
    ) : null,
}));
vi.mock('@/components/ErrorBoundary', () => ({
  default: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/components/InvoiceMarketplaceCard', () => ({
  default: ({ invoice, onFund, isSelected, onToggleCompare, onBookmark, isBookmarked }: any) => (
    <div data-testid={`card-${invoice.id.toString()}`}>
      <span>Invoice #{invoice.id.toString()}</span>
      <button onClick={() => onFund(invoice)}>Fund #{invoice.id.toString()}</button>
      <button onClick={() => onToggleCompare(invoice.id.toString())}>
        {isSelected ? 'Deselect' : 'Select'} #{invoice.id.toString()}
      </button>
      <button onClick={() => onBookmark(invoice.id.toString(), !isBookmarked)}>
        Bookmark #{invoice.id.toString()}
      </button>
    </div>
  ),
}));

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1n,
    status: 'Pending',
    freelancer: 'GFREELANCER',
    payer: 'GPAYER',
    funder: undefined,
    amount: 1_000_000_000n,
    discount_rate: 500,
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 10),
    token: 'USDC_ID',
    ...overrides,
  } as Invoice;
}

describe('MarketplacePage', () => {
  beforeEach(() => {
    walletState.isConnected = true;
    refetchMock.mockClear();
    toggleBookmarkMock.mockClear();
    bookmarkedIds.clear();
    payerRisks.clear();
    useInvoicesMock.mockReset();
    useInvoicesMock.mockReturnValue({ data: [], isLoading: false, refetch: refetchMock });
  });

  it('shows a loading skeleton while invoices load', () => {
    useInvoicesMock.mockReturnValue({ data: [], isLoading: true, refetch: refetchMock });
    const { container } = render(<MarketplacePage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows an empty state when there are no pending invoices', () => {
    render(<MarketplacePage />);
    expect(screen.getByText('No Pending Invoices')).toBeInTheDocument();
  });

  it('only lists Pending invoices', () => {
    useInvoicesMock.mockReturnValue({
      data: [invoice({ id: 1n, status: 'Pending' }), invoice({ id: 2n, status: 'Funded' })],
      isLoading: false,
      refetch: refetchMock,
    });
    render(<MarketplacePage />);
    expect(screen.getByTestId('card-1')).toBeInTheDocument();
    expect(screen.queryByTestId('card-2')).not.toBeInTheDocument();
  });

  it('opens the fund modal via the card action and closes it', () => {
    useInvoicesMock.mockReturnValue({
      data: [invoice({ id: 5n })],
      isLoading: false,
      refetch: refetchMock,
    });
    render(<MarketplacePage />);

    fireEvent.click(screen.getByText('Fund #5'));
    expect(screen.getByTestId('fund-modal')).toHaveTextContent('Funding #5');

    fireEvent.click(screen.getByText('Close Fund Modal'));
    expect(screen.queryByTestId('fund-modal')).not.toBeInTheDocument();
  });

  it('opens and closes the risk settings modal', () => {
    render(<MarketplacePage />);
    fireEvent.click(screen.getByText('Risk Settings'));
    expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close Settings'));
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });

  it('toggles a bookmark and filters by bookmarked invoices', () => {
    useInvoicesMock.mockReturnValue({
      data: [invoice({ id: 1n }), invoice({ id: 2n })],
      isLoading: false,
      refetch: refetchMock,
    });
    render(<MarketplacePage />);

    fireEvent.click(screen.getByText('Bookmark #1'));
    expect(toggleBookmarkMock).toHaveBeenCalledWith('1', true);

    bookmarkedIds.add('1');
    fireEvent.click(screen.getByText(/^Bookmarked/));
    expect(screen.getByTestId('card-1')).toBeInTheDocument();
    expect(screen.queryByTestId('card-2')).not.toBeInTheDocument();
  });

  it('filters by token', () => {
    useInvoicesMock.mockReturnValue({
      data: [invoice({ id: 1n, token: 'USDC_ID' }), invoice({ id: 2n, token: 'EURC_ID' })],
      isLoading: false,
      refetch: refetchMock,
    });
    render(<MarketplacePage />);

    fireEvent.click(screen.getByText('Filters'));
    fireEvent.click(screen.getByLabelText('USDC'));

    expect(screen.getByTestId('card-1')).toBeInTheDocument();
    expect(screen.queryByTestId('card-2')).not.toBeInTheDocument();
    expect(screen.getByText('1 invoice available')).toBeInTheDocument();
  });

  it('filters by risk level', () => {
    payerRisks.set('GPAYER', 'High');
    useInvoicesMock.mockReturnValue({
      data: [invoice({ id: 1n, payer: 'GPAYER' }), invoice({ id: 2n, payer: 'GOTHER' })],
      isLoading: false,
      refetch: refetchMock,
    });
    render(<MarketplacePage />);

    fireEvent.click(screen.getByText('Filters'));
    fireEvent.click(screen.getByLabelText('High'));

    expect(screen.getByTestId('card-1')).toBeInTheDocument();
    expect(screen.queryByTestId('card-2')).not.toBeInTheDocument();
  });

  it('filters by minimum yield', () => {
    useInvoicesMock.mockReturnValue({
      data: [
        invoice({ id: 1n, amount: 1_000_000_000n, discount_rate: 1000 }),
        invoice({ id: 2n, amount: 1_000_000_000n, discount_rate: 10 }),
      ],
      isLoading: false,
      refetch: refetchMock,
    });
    render(<MarketplacePage />);

    fireEvent.click(screen.getByText('Filters'));
    fireEvent.change(screen.getByPlaceholderText('e.g. 2.0'), { target: { value: '5' } });

    expect(screen.getByTestId('card-1')).toBeInTheDocument();
    expect(screen.queryByTestId('card-2')).not.toBeInTheDocument();
  });

  it('filters by maximum amount', () => {
    useInvoicesMock.mockReturnValue({
      data: [
        invoice({ id: 1n, amount: 500_000_000n }),
        invoice({ id: 2n, amount: 50_000_000_000n }),
      ],
      isLoading: false,
      refetch: refetchMock,
    });
    render(<MarketplacePage />);

    fireEvent.click(screen.getByText('Filters'));
    fireEvent.change(screen.getByPlaceholderText('e.g. 10000'), { target: { value: '1000' } });

    expect(screen.getByTestId('card-1')).toBeInTheDocument();
    expect(screen.queryByTestId('card-2')).not.toBeInTheDocument();
  });

  it('filters by minimum discount', () => {
    useInvoicesMock.mockReturnValue({
      data: [invoice({ id: 1n, discount_rate: 800 }), invoice({ id: 2n, discount_rate: 50 })],
      isLoading: false,
      refetch: refetchMock,
    });
    render(<MarketplacePage />);

    fireEvent.click(screen.getByText('Filters'));
    fireEvent.change(document.querySelector('input[type="range"]')!, {
      target: { value: '5' },
    });

    expect(screen.getByTestId('card-1')).toBeInTheDocument();
    expect(screen.queryByTestId('card-2')).not.toBeInTheDocument();
  });

  it('filters by due-date range', () => {
    const soon = Math.floor(Date.now() / 1000) + 86400 * 2;
    const far = Math.floor(Date.now() / 1000) + 86400 * 60;
    useInvoicesMock.mockReturnValue({
      data: [
        invoice({ id: 1n, due_date: BigInt(soon) }),
        invoice({ id: 2n, due_date: BigInt(far) }),
      ],
      isLoading: false,
      refetch: refetchMock,
    });
    render(<MarketplacePage />);

    fireEvent.click(screen.getByText('Filters'));
    const end = new Date((soon + 86400) * 1000).toISOString().split('T')[0];
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: end } });

    expect(screen.getByTestId('card-1')).toBeInTheDocument();
    expect(screen.queryByTestId('card-2')).not.toBeInTheDocument();
  });

  it('clears all active filters', () => {
    useInvoicesMock.mockReturnValue({
      data: [invoice({ id: 1n, token: 'USDC_ID' }), invoice({ id: 2n, token: 'EURC_ID' })],
      isLoading: false,
      refetch: refetchMock,
    });
    render(<MarketplacePage />);

    fireEvent.click(screen.getByText('Filters'));
    fireEvent.click(screen.getByLabelText('USDC'));
    expect(screen.queryByTestId('card-2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear All Filters'));
    expect(screen.getByTestId('card-2')).toBeInTheDocument();
  });

  it('sorts by amount and toggles direction on repeat click', () => {
    useInvoicesMock.mockReturnValue({
      data: [invoice({ id: 1n, amount: 100n }), invoice({ id: 2n, amount: 900n })],
      isLoading: false,
      refetch: refetchMock,
    });
    render(<MarketplacePage />);

    fireEvent.click(screen.getByText(/^Amount/));
    let cards = screen.getAllByTestId(/^card-/);
    expect(cards[0]).toHaveAttribute('data-testid', 'card-2');

    fireEvent.click(screen.getByText(/^Amount/));
    cards = screen.getAllByTestId(/^card-/);
    expect(cards[0]).toHaveAttribute('data-testid', 'card-1');
  });

  it('enables compare mode after two selections and opens the compare modal', () => {
    useInvoicesMock.mockReturnValue({
      data: [invoice({ id: 1n }), invoice({ id: 2n })],
      isLoading: false,
      refetch: refetchMock,
    });
    render(<MarketplacePage />);

    fireEvent.click(screen.getByText('Select #1'));
    expect(screen.getByText('Select 1 more to compare')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Select #2'));
    fireEvent.click(screen.getByText('Compare (2)'));

    expect(screen.getByText('Compare Invoices')).toBeInTheDocument();
    expect(screen.getAllByText(/Invoice #/).length).toBeGreaterThan(0);
  });

  it('paginates when there are more than 20 pending invoices', () => {
    const invoices = Array.from({ length: 25 }, (_, i) => invoice({ id: BigInt(i + 1) }));
    useInvoicesMock.mockReturnValue({ data: invoices, isLoading: false, refetch: refetchMock });
    render(<MarketplacePage />);

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeDisabled();

    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeDisabled();
  });
});
