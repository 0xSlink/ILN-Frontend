import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LPYieldComparison from '../LPYieldComparison';

const approvedTokens = [
  { contractId: 'token-usdc', name: 'USD Coin', symbol: 'USDC', decimals: 7, iconLabel: 'US' },
  { contractId: 'token-eurc', name: 'Euro Coin', symbol: 'EURC', decimals: 7, iconLabel: 'EU' },
];

const fetchThreeMonthTBillRatePctMock = vi.fn();
const buildTokenYieldComparisonMock = vi.fn();
const buildYieldTimeSeriesMock = vi.fn();

const balancesState = {
  balances: new Map<string, bigint>([['token-usdc', 12_500_000_000n]]),
  unavailable: new Set<string>(),
  isLoading: false,
  refetch: vi.fn(),
};

const approvedTokensState = {
  tokens: approvedTokens,
  tokenMap: new Map(approvedTokens.map((t) => [t.contractId, t])),
  defaultToken: approvedTokens[0],
  isLoading: false,
  error: null,
};

const yieldRows = [
  { symbol: 'USDC', lpYieldPct: 5.2, protocolYieldPct: 4.8, tBillYieldPct: 4.5, premiumBps: 70 },
  { symbol: 'EURC', lpYieldPct: 3.1, protocolYieldPct: 3.0, tBillYieldPct: 4.5, premiumBps: -140 },
  { symbol: 'XLM', lpYieldPct: 6.4, protocolYieldPct: 6.0, tBillYieldPct: 4.5, premiumBps: 190 },
];

const nonZeroTimeseries = [
  { date: 'Jan 1', isoDate: '2026-01-01', USDC: 5.2, EURC: 3.1, XLM: 6.4 },
  { date: 'Jan 2', isoDate: '2026-01-02', USDC: 5.4, EURC: 3.0, XLM: 6.1 },
];

const zeroTimeseries = [{ date: 'Jan 1', isoDate: '2026-01-01', USDC: 0, EURC: 0, XLM: 0 }];

vi.mock('@/hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => approvedTokensState,
}));

vi.mock('@/hooks/useBalances', () => ({
  useBalances: () => balancesState,
}));

vi.mock('@/lib/treasury-rates', () => ({
  fetchThreeMonthTBillRatePct: (...args: unknown[]) => fetchThreeMonthTBillRatePctMock(...args),
}));

vi.mock('@/utils/lp-yield-comparison', async () => {
  const actual = await vi.importActual<typeof import('@/utils/lp-yield-comparison')>(
    '@/utils/lp-yield-comparison'
  );
  return {
    ...actual,
    buildTokenYieldComparison: (...args: unknown[]) => buildTokenYieldComparisonMock(...args),
  };
});

vi.mock('@/utils/yield-timeseries', () => ({
  buildYieldTimeSeries: (...args: unknown[]) => buildYieldTimeSeriesMock(...args),
}));

describe('LPYieldComparison', () => {
  beforeEach(() => {
    fetchThreeMonthTBillRatePctMock.mockReset();
    fetchThreeMonthTBillRatePctMock.mockResolvedValue(4.5);
    buildTokenYieldComparisonMock.mockReset();
    buildTokenYieldComparisonMock.mockReturnValue(yieldRows);
    buildYieldTimeSeriesMock.mockReset();
    buildYieldTimeSeriesMock.mockReturnValue(nonZeroTimeseries);
    balancesState.balances = new Map([['token-usdc', 12_500_000_000n]]);
    balancesState.isLoading = false;
    approvedTokensState.isLoading = false;
  });

  it('shows a loading skeleton while the T-bill rate has not resolved', () => {
    fetchThreeMonthTBillRatePctMock.mockReturnValue(new Promise(() => {}));
    const { container } = render(<LPYieldComparison invoices={[]} lpAddress="GLP" />);

    expect(screen.queryByText('Yield Analytics')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows a loading skeleton when isLoading is passed regardless of T-bill state', () => {
    const { container } = render(<LPYieldComparison invoices={[]} lpAddress="GLP" isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders the default USDC stats once loaded', async () => {
    render(<LPYieldComparison invoices={[]} lpAddress="GLP" />);

    await screen.findByText('Yield Analytics');
    expect(screen.getByText('5.20%')).toBeInTheDocument();
    expect(screen.getByText('+70 bps over risk-free rate')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('switches stats when a different token tab is selected', async () => {
    render(<LPYieldComparison invoices={[]} lpAddress="GLP" />);
    await screen.findByText('Yield Analytics');

    fireEvent.click(screen.getByRole('button', { name: 'XLM' }));

    expect(screen.getByText('6.40%')).toBeInTheDocument();
    expect(screen.getByText('+190 bps over risk-free rate')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('requests a new time series when the range selector changes', async () => {
    render(<LPYieldComparison invoices={[]} lpAddress="GLP" />);
    await screen.findByText('Yield Analytics');

    buildYieldTimeSeriesMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '7D' }));

    expect(buildYieldTimeSeriesMock).toHaveBeenCalledWith([], 'GLP', 7);
  });

  it('shows an empty state and hides export when there is no historical data', async () => {
    buildYieldTimeSeriesMock.mockReturnValue(zeroTimeseries);
    render(<LPYieldComparison invoices={[]} lpAddress="GLP" />);

    await screen.findByText('No historical yield data available for the selected range.');
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
  });

  it('exports the chart data as a CSV file when data is present', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    // @ts-expect-error - jsdom doesn't implement URL.createObjectURL
    URL.createObjectURL = createObjectURL;
    // @ts-expect-error - jsdom doesn't implement URL.revokeObjectURL
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<LPYieldComparison invoices={[]} lpAddress="GLP" />);
    await screen.findByText('Export CSV');
    fireEvent.click(screen.getByText('Export CSV'));

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('shows a loading placeholder for liquidity while balances or tokens are loading', async () => {
    balancesState.isLoading = true;
    render(<LPYieldComparison invoices={[]} lpAddress="GLP" />);

    await screen.findByText('Yield Analytics');
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('shows the formatted wallet balance for the selected token once loaded', async () => {
    render(<LPYieldComparison invoices={[]} lpAddress="GLP" />);
    await screen.findByText('Yield Analytics');

    expect(screen.getByText('1,250 USDC')).toBeInTheDocument();
  });
});
