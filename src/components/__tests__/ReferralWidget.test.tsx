import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReferralWidget from '../ReferralWidget';

const walletState = { address: 'GADDR' as string | null, isConnected: true };
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

describe('ReferralWidget', () => {
  beforeEach(() => {
    walletState.address = 'GADDR';
    walletState.isConnected = true;
    generateReferralCodeMock.mockClear();
    getReferralLinkMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    useReferralStatsMock.mockReset();
    useReferralStatsMock.mockReturnValue({ data: undefined, isLoading: true });
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('renders nothing when the wallet is not connected', () => {
    walletState.isConnected = false;
    const { container } = render(<ReferralWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows loading placeholders while stats load', () => {
    render(<ReferralWidget />);
    expect(screen.getAllByText('...').length).toBeGreaterThan(0);
  });

  it('shows an empty referral history state once stats resolve with none', async () => {
    useReferralStatsMock.mockReturnValue({
      data: { total_invoices: 0, total_volume: 0n },
      isLoading: false,
    });
    render(<ReferralWidget />);
    await waitFor(() =>
      expect(
        screen.getByText('No referrals yet. Share your link to get started!')
      ).toBeInTheDocument()
    );
  });

  it('renders a history table capped at 5 entries', async () => {
    useReferralStatsMock.mockReturnValue({
      data: { total_invoices: 8, total_volume: 500_000_000n },
      isLoading: false,
    });
    render(<ReferralWidget />);

    await waitFor(() => expect(screen.getAllByText(/Referred User/).length).toBe(5));
  });

  it('copies the referral link and shows a success toast, then resets after a timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useReferralStatsMock.mockReturnValue({
      data: { total_invoices: 1, total_volume: 0n },
      isLoading: false,
    });
    render(<ReferralWidget />);

    await waitFor(() => expect(screen.getByText('Share Referral Link')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Share Referral Link'));

    await waitFor(() => expect(screen.getByText('Link Copied!')).toBeInTheDocument());
    expect(toastSuccessMock).toHaveBeenCalledWith('Referral link copied!');

    vi.advanceTimersByTime(2000);
    await waitFor(() => expect(screen.getByText('Share Referral Link')).toBeInTheDocument());
    vi.useRealTimers();
  });

  it('shows an error toast when the clipboard write fails', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    useReferralStatsMock.mockReturnValue({
      data: { total_invoices: 1, total_volume: 0n },
      isLoading: false,
    });
    render(<ReferralWidget />);
    await waitFor(() => expect(screen.getByText('Share Referral Link')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Share Referral Link'));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Failed to copy link.'));
  });
});
