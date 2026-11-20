import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveStatsIndexerFreshness, type ContractStats } from '@/utils/contract-stats';
import ProtocolStatsScreen from '../ProtocolStats';

const mockUseContractStats = vi.fn();
const mockUseInvoices = vi.fn();

vi.mock('@/hooks/useContractStats', () => ({
  useContractStats: () => mockUseContractStats(),
}));

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => mockUseInvoices(),
}));

vi.mock('@/components/Navbar', () => ({ default: () => <nav data-testid="navbar" /> }));
vi.mock('@/components/Footer', () => ({ default: () => <footer data-testid="footer" /> }));

vi.mock('@/components/stats/StatsMetricCards', () => ({
  default: () => <div data-testid="stats-metric-cards" />,
}));
vi.mock('@/components/stats/StatsDisputeRateCard', () => ({
  default: () => <div data-testid="stats-dispute-rate-card" />,
}));
vi.mock('@/components/stats/StatsVolumeChart', () => ({
  default: () => <div data-testid="stats-volume-chart" />,
}));
vi.mock('@/components/stats/StatsTokenBreakdown', () => ({
  default: () => <div data-testid="stats-token-breakdown" />,
}));
vi.mock('@/components/stats/ProtocolYieldAnalyticsSection', () => ({
  default: () => <div data-testid="protocol-yield-analytics" />,
}));

const stats = {
  total_invoices: 42,
  total_funded: 30,
  total_paid: 22,
  total_volume_usd: 185_000,
  dispute_rate: { total_disputes: 3, dispute_rate_pct: 7.1 },
  daily_volume: [],
  volume_by_token: [],
} as unknown as ContractStats;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

describe('ProtocolStatsScreen', () => {
  beforeEach(() => {
    mockUseInvoices.mockReturnValue({ data: [], isLoading: false });
  });

  it('renders a loading skeleton and no stat cards while the query is in flight', () => {
    mockUseContractStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<ProtocolStatsScreen />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('stats-metric-cards')).not.toBeInTheDocument();
  });

  it('surfaces the error message when the stats query fails', () => {
    mockUseContractStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('indexer unreachable'),
      refetch: vi.fn(),
    });
    render(<ProtocolStatsScreen />);

    expect(screen.getByText('Failed to load stats: indexer unreachable')).toBeInTheDocument();
    expect(screen.queryByTestId('stats-metric-cards')).not.toBeInTheDocument();
  });

  it('falls back to a generic message for a non-Error rejection', () => {
    mockUseContractStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: 'boom',
      refetch: vi.fn(),
    });
    render(<ProtocolStatsScreen />);

    expect(screen.getByText('Failed to load stats: Unknown error')).toBeInTheDocument();
  });

  it('renders every stat section once stats are available', () => {
    mockUseContractStats.mockReturnValue({
      data: stats,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ProtocolStatsScreen />);

    expect(screen.getByTestId('stats-metric-cards')).toBeInTheDocument();
    expect(screen.getByTestId('stats-dispute-rate-card')).toBeInTheDocument();
    expect(screen.getByTestId('stats-volume-chart')).toBeInTheDocument();
    expect(screen.getByTestId('stats-token-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('protocol-yield-analytics')).toBeInTheDocument();
    expect(screen.queryByText(/Failed to load stats/)).not.toBeInTheDocument();
  });

  it('passes the invoices loading state through to the yield analytics section', () => {
    mockUseContractStats.mockReturnValue({
      data: stats,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseInvoices.mockReturnValue({ data: undefined, isLoading: true });
    render(<ProtocolStatsScreen />);

    expect(screen.getByTestId('protocol-yield-analytics')).toBeInTheDocument();
  });

  it('renders neither skeleton nor banner once loading has settled with data', () => {
    mockUseContractStats.mockReturnValue({
      data: stats,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<ProtocolStatsScreen />);

    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('displays last indexed ledger and age alongside stats when freshness is fresh', () => {
    const freshStats: ContractStats = {
      ...stats,
      indexerFreshness: {
        lastIndexedLedger: 512_345,
        lastIndexedAt: new Date(Date.now() - 15_000).toISOString(),
        staleAfterMs: 5 * 60_000,
      },
    };
    mockUseContractStats.mockReturnValue({
      data: freshStats,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ProtocolStatsScreen />);

    expect(screen.getByTestId('protocol-stats-freshness')).toHaveTextContent(/ledger #512,345/i);
    expect(screen.getByTestId('protocol-stats-freshness')).toHaveTextContent(/just now/i);
    expect(screen.getByText(/Live overview of the Invoice Liquidity Network/i)).toBeInTheDocument();
    expect(screen.queryByTestId('protocol-stats-stale-banner')).not.toBeInTheDocument();
  });

  it('blocks live success messaging and shows a stale alert with retry when indexer data is stale', () => {
    const refetch = vi.fn();
    const staleStats: ContractStats = {
      ...stats,
      indexerFreshness: {
        lastIndexedLedger: 510_000,
        lastIndexedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
        staleAfterMs: 5 * 60_000,
      },
    };
    mockUseContractStats.mockReturnValue({
      data: staleStats,
      isLoading: false,
      error: null,
      refetch,
    });
    render(<ProtocolStatsScreen />);

    expect(screen.queryByText(/Live overview of the Invoice Liquidity Network/i)).not.toBeInTheDocument();
    const staleBanner = screen.getByTestId('protocol-stats-stale-banner');
    expect(staleBanner).toHaveTextContent(/ledger #510,000/i);
    expect(staleBanner).toHaveTextContent(/20 minutes ago/i);

    fireEvent.click(screen.getByRole('button', { name: /refresh stats/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('suppresses live success messaging when freshness metadata is unknown', () => {
    mockUseContractStats.mockReturnValue({
      data: stats,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ProtocolStatsScreen />);

    expect(screen.queryByText(/Live overview of the Invoice Liquidity Network/i)).not.toBeInTheDocument();
    expect(screen.getByText(/indexer freshness could not be verified/i)).toBeInTheDocument();
    expect(screen.getByTestId('protocol-stats-freshness')).toHaveTextContent(/freshness unknown/i);
  });
});

describe('deriveStatsIndexerFreshness', () => {
  it('picks the highest valid ledger and latest timestamp across events', () => {
    const freshness = deriveStatsIndexerFreshness([
      { type: 'InvoiceSubmitted', ledger: 100, createdAt: '2026-07-01T10:00:00.000Z' },
      { type: 'InvoiceFunded', ledger: 125, createdAt: '2026-07-01T10:05:00.000Z' },
      { type: 'InvoicePaid', ledger: 120, createdAt: 'invalid-date' },
    ]);
    expect(freshness.lastIndexedLedger).toBe(125);
    expect(freshness.lastIndexedAt).toBe('2026-07-01T10:05:00.000Z');
  });

  it('keeps ledger and timestamp null when events omit metadata', () => {
    const freshness = deriveStatsIndexerFreshness([]);
    expect(freshness.lastIndexedLedger).toBeNull();
    expect(freshness.lastIndexedAt).toBeNull();
  });
});
