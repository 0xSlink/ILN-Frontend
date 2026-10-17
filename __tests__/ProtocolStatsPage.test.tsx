import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ContractStats } from '@/utils/contract-stats';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    isConnected: false,
    address: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTx: null,
    isInstalled: true,
    error: null,
    networkMismatch: false,
  }),
}));

// These pages render the app chrome (notification bell), which needs the
// notification context.
vi.mock('@/context/NotificationContext', () => ({
  useNotification: () => ({
    notifications: [],
    unreadCount: 0,
    setNotifications: vi.fn(),
    addNotification: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    clearUnread: vi.fn(),
    isRead: vi.fn(() => true),
  }),
}));

const mockUseContractStats = vi.fn();
vi.mock('@/hooks/useContractStats', () => ({
  useContractStats: () => mockUseContractStats(),
}));

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => ({ data: [], isLoading: false }),
}));

// Recharts ResizeObserver polyfill (must be a class, not a plain function)
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockStats: ContractStats = {
  total_invoices: 42,
  total_funded: 30,
  total_paid: 22,
  total_volume_usd: 185_000,
  volume_by_token: [
    {
      symbol: 'USDC',
      amount_raw: 120_000,
      amount_usd: 120_000,
      percentage: 64.86,
      color: 'var(--color-primary)',
    },
    {
      symbol: 'EURC',
      amount_raw: 50_000,
      amount_usd: 54_000,
      percentage: 29.19,
      color: 'var(--color-secondary)',
    },
    {
      symbol: 'XLM',
      amount_raw: 91_667,
      amount_usd: 11_000,
      percentage: 5.95,
      color: 'var(--color-tertiary)',
    },
  ],
  daily_volume: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
    label: `Day ${i + 1}`,
    volume_usd: 3_000 + i * 100,
    usdc: 1_500 + i * 50,
    eurc: 1_000 + i * 30,
    xlm: 500 + i * 20,
  })),
  dispute_rate: {
    rate30dPercent: 2.5,
    funded30d: 40,
    disputed30d: 1,
    dailyTrend90d: Array.from({ length: 90 }, (_, i) => ({
      date: new Date(Date.now() - (89 - i) * 86_400_000).toISOString().slice(0, 10),
      label: `Day ${i + 1}`,
      fundedCount: 1,
      disputedCount: 0,
      ratePercent: 0,
    })),
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

import ProtocolStatsScreen from '@/screens/ProtocolStats';

describe('ProtocolStatsPage', () => {
  beforeEach(() => {
    mockUseContractStats.mockReset();
  });

  it('renders loading skeleton while fetching', () => {
    mockUseContractStats.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { container } = render(<ProtocolStatsScreen />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error banner when fetch fails', () => {
    mockUseContractStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('RPC unreachable'),
    });
    render(<ProtocolStatsScreen />);
    expect(screen.getByText(/RPC unreachable/i)).toBeInTheDocument();
  });

  it('renders all four metric cards with correct values', async () => {
    mockUseContractStats.mockReturnValue({ data: mockStats, isLoading: false, error: null });
    render(<ProtocolStatsScreen />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('22')).toBeInTheDocument();
      // $185.0K appears in the metric card AND the token breakdown total
      const volumeElements = screen.getAllByText('$185.0K');
      expect(volumeElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders metric card labels', async () => {
    mockUseContractStats.mockReturnValue({ data: mockStats, isLoading: false, error: null });
    render(<ProtocolStatsScreen />);

    await waitFor(() => {
      expect(screen.getAllByText(/Total Invoices/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Total Funded/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Total Paid/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Total Volume/i).length).toBeGreaterThan(0);
    });
  });

  it('renders token breakdown section with all tokens', async () => {
    mockUseContractStats.mockReturnValue({ data: mockStats, isLoading: false, error: null });
    render(<ProtocolStatsScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('USDC').length).toBeGreaterThan(0);
      expect(screen.getAllByText('EURC').length).toBeGreaterThan(0);
      expect(screen.getAllByText('XLM').length).toBeGreaterThan(0);
    });
  });

  it('renders token breakdown percentages', async () => {
    mockUseContractStats.mockReturnValue({ data: mockStats, isLoading: false, error: null });
    render(<ProtocolStatsScreen />);

    await waitFor(() => {
      expect(screen.getByText('64.9%')).toBeInTheDocument();
      expect(screen.getByText('29.2%')).toBeInTheDocument();
      expect(screen.getByText('6.0%')).toBeInTheDocument();
    });
  });

  it('renders historical volume chart section', async () => {
    mockUseContractStats.mockReturnValue({ data: mockStats, isLoading: false, error: null });
    render(<ProtocolStatsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Historical Volume')).toBeInTheDocument();
    });
  });

  it('renders yield analytics section', async () => {
    mockUseContractStats.mockReturnValue({ data: mockStats, isLoading: false, error: null });
    render(<ProtocolStatsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Yield Analytics')).toBeInTheDocument();
    });
  });

  it('renders page heading and subtitle', async () => {
    mockUseContractStats.mockReturnValue({ data: mockStats, isLoading: false, error: null });
    render(<ProtocolStatsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Protocol Statistics')).toBeInTheDocument();
      expect(screen.getByText(/Live overview/i)).toBeInTheDocument();
    });
  });

  it('shows empty chart message when daily_volume is all zeros', async () => {
    const emptyVolumeStats: ContractStats = {
      ...mockStats,
      daily_volume: mockStats.daily_volume.map((d) => ({
        ...d,
        volume_usd: 0,
        usdc: 0,
        eurc: 0,
        xlm: 0,
      })),
    };
    mockUseContractStats.mockReturnValue({ data: emptyVolumeStats, isLoading: false, error: null });
    render(<ProtocolStatsScreen />);

    await waitFor(() => {
      expect(screen.getByText(/No volume data/i)).toBeInTheDocument();
    });
  });
});
