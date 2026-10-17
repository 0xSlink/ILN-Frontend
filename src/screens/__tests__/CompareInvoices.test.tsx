import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CompareInvoicesScreen from '../CompareInvoices';
import React from 'react';

// Mock hooks and utilities
// These objects must keep a stable identity across renders: the screen's fetch
// effect depends on them, so fresh objects would re-fetch on every render.
vi.mock('next/navigation', () => {
  const searchParams = { get: vi.fn().mockReturnValue('1,2,3') };
  const router = { push: vi.fn() };
  return {
    useSearchParams: () => searchParams,
    useRouter: () => router,
  };
});

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GD...',
    connect: vi.fn(),
    signTx: vi.fn(),
  }),
}));

// Rendered subtrees pull in the notification bell/drawer, which require the
// NotificationProvider.
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

vi.mock('@/context/ToastContext', () => {
  const toast = { addToast: vi.fn(), updateToast: vi.fn() };
  return { useToast: () => toast };
});

vi.mock('@/utils/soroban', () => ({
  getAllInvoices: vi.fn().mockResolvedValue([
    {
      id: BigInt(1),
      amount: BigInt(10000000),
      discount_rate: 500,
      due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 10),
      payer: 'P1',
      status: 'Pending',
    },
    {
      id: BigInt(2),
      amount: BigInt(20000000),
      discount_rate: 600,
      due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 5),
      payer: 'P2',
      status: 'Pending',
    },
    {
      id: BigInt(3),
      amount: BigInt(30000000),
      discount_rate: 400,
      due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 15),
      payer: 'P3',
      status: 'Pending',
    },
  ]),
  getPayerScoresBatch: vi.fn().mockResolvedValue(new Map()),
  fundInvoice: vi.fn(),
  submitSignedTransaction: vi.fn(),
}));

vi.mock('@/hooks/useApprovedTokens', () => {
  const result = {
    tokens: [],
    tokenMap: new Map(),
    defaultToken: { symbol: 'USDC', decimals: 7, contractId: 'TOKEN_ID' },
  };
  return { useApprovedTokens: () => result };
});

vi.mock('@/hooks/usePayerScores', () => ({
  usePayerScores: () => ({
    scores: new Map([
      ['P1', 80],
      ['P2', 90],
      ['P3', 70],
    ]),
    risks: new Map([
      ['P1', 'Low'],
      ['P2', 'Low'],
      ['P3', 'Medium'],
    ]),
  }),
}));

describe('CompareInvoicesScreen', () => {
  it('renders comparison table for selected IDs', async () => {
    render(<CompareInvoicesScreen />);

    // Wait for data to load
    const invoice1 = await screen.findByText(/Invoice #1/i);
    const [invoice2] = await screen.findAllByText(/Invoice #2/i);
    const invoice3 = await screen.findByText(/Invoice #3/i);

    expect(invoice1).toBeInTheDocument();
    expect(invoice2).toBeInTheDocument();
    expect(invoice3).toBeInTheDocument();
  });

  it('correctly identifies and highlights best values', async () => {
    render(<CompareInvoicesScreen />);

    await screen.findByText(/Invoice #1/i);

    // Highest APY should be Invoice #2 (600 bps and shortest duration)
    // Lowest Days to Maturity should be Invoice #2 (5 days)
    // Highest Payer Score should be P2 (90)

    const bestValueBadges = await screen.findAllByText(/Best Value/i);
    expect(bestValueBadges.length).toBeGreaterThan(0);
  });

  it('generates a comparative summary', async () => {
    render(<CompareInvoicesScreen />);

    const summaryHeader = await screen.findByText(/Comparative Insight/i);
    expect(summaryHeader).toBeInTheDocument();

    const summaryText = screen.getByText(/offers the highest APY/i);
    expect(summaryText).toBeInTheDocument();
  });
});
