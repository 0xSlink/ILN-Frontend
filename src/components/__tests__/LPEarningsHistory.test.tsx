import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LPEarningsHistory from '../LPEarningsHistory';
import type { Invoice } from '@/utils/soroban';

const WALLET = 'GWALLETWALLETWALLETWALLETWALLETWALLETWALLETWALLETWXYZ';
const TOKEN = { contractId: 'token-usdc', name: 'USD Coin', symbol: 'USDC', decimals: 7 };
const tokenMap = new Map([[TOKEN.contractId, TOKEN]]);

function paidInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1n,
    freelancer: 'GFREELANCER',
    payer: 'GPAYER1234567890',
    amount: 1_000_000_000n,
    due_date: 1_900_000_000n,
    discount_rate: 500,
    status: 'Paid',
    funder: WALLET,
    funded_at: 1_800_000_000n,
    token: TOKEN.contractId,
    ...overrides,
  } as Invoice;
}

const exportToCSVMock = vi.fn();
const fetchProtocolParametersMock = vi.fn();
const useMediaQueryMock = vi.fn(() => false);

vi.mock('@/utils/exportData', () => ({
  exportToCSV: (...args: unknown[]) => exportToCSVMock(...args),
}));

vi.mock('@/utils/governance', () => ({
  fetchProtocolParameters: (...args: unknown[]) => fetchProtocolParametersMock(...args),
}));

vi.mock('@/hooks/useMediaQuery', () => {
  const useMediaQueryDefault = (...args: unknown[]) => useMediaQueryMock(...args);
  return {
    default: useMediaQueryDefault,
    MOBILE_QUERY: '(max-width: 639px)',
  };
});

vi.mock('../ProgressiveDisclosureCards', () => ({
  default: ({ data }: { data: unknown[] }) => (
    <div data-testid="mobile-cards">Mobile cards: {data.length}</div>
  ),
}));

describe('LPEarningsHistory', () => {
  beforeEach(() => {
    exportToCSVMock.mockClear();
    fetchProtocolParametersMock.mockReset();
    fetchProtocolParametersMock.mockResolvedValue({ feeRateBps: 200 });
    useMediaQueryMock.mockReset();
    useMediaQueryMock.mockReturnValue(false);
  });

  it('prompts wallet connection when no wallet address is provided', () => {
    render(
      <LPEarningsHistory
        invoices={[]}
        tokenMap={tokenMap}
        defaultToken={TOKEN}
        walletAddress={null}
      />
    );
    expect(screen.getByText('Connect your wallet to view earnings history.')).toBeInTheDocument();
  });

  it('shows an empty state when the wallet has no settled invoices', () => {
    render(
      <LPEarningsHistory
        invoices={[paidInvoice({ status: 'Pending', funded_at: undefined })]}
        tokenMap={tokenMap}
        defaultToken={TOKEN}
        walletAddress={WALLET}
      />
    );
    expect(screen.getByText('No settled earnings history is available yet.')).toBeInTheDocument();
    expect(screen.queryByText('Yield Projections')).not.toBeInTheDocument();
  });

  it('excludes invoices funded by a different wallet', () => {
    render(
      <LPEarningsHistory
        invoices={[paidInvoice({ id: 5n, funder: 'GSOMEONEELSE' })]}
        tokenMap={tokenMap}
        defaultToken={TOKEN}
        walletAddress={WALLET}
      />
    );
    expect(screen.getByText('No settled earnings history is available yet.')).toBeInTheDocument();
  });

  it('renders settled invoice rows with computed amount, payout, earned, and fee', async () => {
    render(
      <LPEarningsHistory
        invoices={[paidInvoice({ id: 3n })]}
        tokenMap={tokenMap}
        defaultToken={TOKEN}
        walletAddress={WALLET}
      />
    );

    expect(screen.getByText('#3')).toBeInTheDocument();
    // amount = 1_000_000_000n @ 7 decimals -> "100 USDC"
    expect(screen.getByText('100 USDC')).toBeInTheDocument();
    // yield = amount * discount_rate(500 bps) / 10000 = 50_000_000n -> "5 USDC"
    expect(screen.getByText('5 USDC')).toBeInTheDocument();
    // payout = amount + yield = 1_050_000_000n -> "105 USDC"
    expect(screen.getByText('105 USDC')).toBeInTheDocument();

    // Fee: once feeRateBps (200) resolves, fee = yield * 200 / 10000 = 1_000_000n -> "0.1000000 USDC"
    await waitFor(() => {
      expect(screen.getByText('0.1000000 USDC')).toBeInTheDocument();
    });
    expect(screen.queryByText('0% Fee')).not.toBeInTheDocument();
  });

  it('shows a 0% Fee badge once the protocol fee resolves to zero', async () => {
    fetchProtocolParametersMock.mockResolvedValue({ feeRateBps: 0 });
    render(
      <LPEarningsHistory
        invoices={[paidInvoice()]}
        tokenMap={tokenMap}
        defaultToken={TOKEN}
        walletAddress={WALLET}
      />
    );
    await screen.findByText('0% Fee');
  });

  it('shows and toggles the yield projections panel', async () => {
    render(
      <LPEarningsHistory
        invoices={[paidInvoice()]}
        tokenMap={tokenMap}
        defaultToken={TOKEN}
        walletAddress={WALLET}
      />
    );

    expect(screen.getByText('Yield Projections')).toBeInTheDocument();
    expect(screen.getByText('30-Day')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Hide'));
    expect(screen.queryByText('30-Day')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show'));
    expect(screen.getByText('30-Day')).toBeInTheDocument();
  });

  it('exports settled invoices as CSV with a dated filename', () => {
    render(
      <LPEarningsHistory
        invoices={[paidInvoice()]}
        tokenMap={tokenMap}
        defaultToken={TOKEN}
        walletAddress={WALLET}
      />
    );

    fireEvent.click(screen.getByText('Export CSV'));

    expect(exportToCSVMock).toHaveBeenCalledTimes(1);
    const [data, filename] = exportToCSVMock.mock.calls[0];
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ 'Invoice ID': '#1' });
    expect(filename).toMatch(/^ILN-LP-Earnings-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('paginates when there are more than 20 settled invoices', () => {
    const invoices = Array.from({ length: 25 }, (_, i) =>
      paidInvoice({ id: BigInt(i + 1), funded_at: BigInt(1_800_000_000 + i) })
    );
    render(
      <LPEarningsHistory
        invoices={invoices}
        tokenMap={tokenMap}
        defaultToken={TOKEN}
        walletAddress={WALLET}
      />
    );

    expect(screen.getByText('Showing 1–20 of 25 records')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeDisabled();

    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Showing 21–25 of 25 records')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeDisabled();

    fireEvent.click(screen.getByText('Previous'));
    expect(screen.getByText('Showing 1–20 of 25 records')).toBeInTheDocument();
  });

  it('renders the mobile progressive-disclosure cards when on a small viewport', () => {
    useMediaQueryMock.mockReturnValue(true);
    render(
      <LPEarningsHistory
        invoices={[paidInvoice()]}
        tokenMap={tokenMap}
        defaultToken={TOKEN}
        walletAddress={WALLET}
      />
    );

    expect(screen.getByTestId('mobile-cards')).toHaveTextContent('Mobile cards: 1');
  });
});
