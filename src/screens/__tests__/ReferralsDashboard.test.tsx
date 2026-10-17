import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReferralsDashboard from '../ReferralsDashboard';

vi.mock('@/components/Navbar', () => ({ default: () => <nav data-testid="navbar" /> }));
vi.mock('@/components/Footer', () => ({ default: () => <footer data-testid="footer" /> }));

const walletState = { address: 'GADDR' as string | null, isConnected: true, connect: vi.fn() };
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

const generateReferralCodeMock = vi.fn(async (address: string) => `CODE-${address}`);
const getReferralLinkMock = vi.fn((code: string) => `https://iln.app/r/${code}`);
vi.mock('@/utils/referrals', () => ({
  generateReferralCode: (...args: [string]) => generateReferralCodeMock(...args),
  getReferralLink: (...args: [string]) => getReferralLinkMock(...args),
}));

const useReferralStatsMock = vi.fn();
vi.mock('@/hooks/useReferralStats', () => ({
  useReferralStats: (...args: unknown[]) => useReferralStatsMock(...args),
}));

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

const openMock = vi.fn();

describe('ReferralsDashboard', () => {
  beforeEach(() => {
    walletState.address = 'GADDR';
    walletState.isConnected = true;
    walletState.connect.mockClear();
    generateReferralCodeMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    useReferralStatsMock.mockReset();
    useReferralStatsMock.mockReturnValue({ data: undefined, isLoading: true, error: null });
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    (window as any).open = openMock;
    openMock.mockClear();
  });

  it('prompts wallet connection when disconnected', () => {
    walletState.isConnected = false;
    render(<ReferralsDashboard />);
    expect(screen.getByText('Referral Program')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Connect Wallet'));
    expect(walletState.connect).toHaveBeenCalled();
  });

  it('shows the referral code and stats once loaded', async () => {
    useReferralStatsMock.mockReturnValue({
      data: { total_invoices: 3, total_volume: 900_000_000n },
      isLoading: false,
      error: null,
    });
    render(<ReferralsDashboard />);
    await waitFor(() => expect(screen.getByText('CODE-GADDR')).toBeInTheDocument());
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows an error banner when stats fail to load', async () => {
    useReferralStatsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('x'),
    });
    render(<ReferralsDashboard />);
    expect(await screen.findByText('Failed to load referral stats.')).toBeInTheDocument();
  });

  it('copies the referral code and link with distinct confirmation states', async () => {
    useReferralStatsMock.mockReturnValue({
      data: { total_invoices: 1, total_volume: 0n },
      isLoading: false,
      error: null,
    });
    render(<ReferralsDashboard />);
    await waitFor(() => expect(screen.getByText('CODE-GADDR')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Copy'));
    await waitFor(() => expect(screen.getByText('Copied')).toBeInTheDocument());
    expect(toastSuccessMock).toHaveBeenCalledWith('Code copied!');

    fireEvent.click(screen.getByText('Copy Link'));
    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());
    expect(toastSuccessMock).toHaveBeenCalledWith('Link copied to clipboard');
  });

  it('shows an error toast when copying fails', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    useReferralStatsMock.mockReturnValue({
      data: { total_invoices: 1, total_volume: 0n },
      isLoading: false,
      error: null,
    });
    render(<ReferralsDashboard />);
    await waitFor(() => expect(screen.getByText('CODE-GADDR')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Copy'));
    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to copy. Please copy manually.')
    );
  });

  it('opens a share window for X, Telegram, and WhatsApp', async () => {
    useReferralStatsMock.mockReturnValue({
      data: { total_invoices: 1, total_volume: 0n },
      isLoading: false,
      error: null,
    });
    render(<ReferralsDashboard />);
    await waitFor(() => expect(screen.getByText('CODE-GADDR')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Share on X'));
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining('twitter.com/intent/tweet'),
      '_blank',
      'noopener,noreferrer'
    );

    fireEvent.click(screen.getByText('Telegram'));
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining('t.me/share'),
      '_blank',
      'noopener,noreferrer'
    );

    fireEvent.click(screen.getByText('WhatsApp'));
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining('wa.me'),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('navigates to a mailto link for email sharing', async () => {
    useReferralStatsMock.mockReturnValue({
      data: { total_invoices: 1, total_volume: 0n },
      isLoading: false,
      error: null,
    });
    render(<ReferralsDashboard />);
    await waitFor(() => expect(screen.getByText('CODE-GADDR')).toBeInTheDocument());

    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { ...originalLocation, href: '' };

    fireEvent.click(screen.getByText('Email'));
    expect(window.location.href).toContain('mailto:');

    (window as any).location = originalLocation;
  });

  it('shows a loading state for the history table, then an empty state', async () => {
    useReferralStatsMock.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { rerender } = render(<ReferralsDashboard />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);

    useReferralStatsMock.mockReturnValue({
      data: { total_invoices: 0, total_volume: 0n },
      isLoading: false,
      error: null,
    });
    rerender(<ReferralsDashboard />);
    await waitFor(() => expect(screen.getByText('No referrals yet')).toBeInTheDocument());
  });

  it('renders up to 50 history rows from referral stats', async () => {
    useReferralStatsMock.mockReturnValue({
      data: { total_invoices: 60, total_volume: 0n },
      isLoading: false,
      error: null,
    });
    render(<ReferralsDashboard />);
    await waitFor(() => expect(screen.getAllByText(/^Referred User #\d+$/).length).toBe(50));
  });
});
