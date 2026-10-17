import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DecayWarningBanner } from '../DecayWarningBanner';

const walletState = { address: 'GCONNECTED' as string | null };
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

const useReputationDecayMock = vi.fn();
vi.mock('@/hooks/useReputationDecay', () => ({
  useReputationDecay: (...args: unknown[]) => useReputationDecayMock(...args),
}));

describe('DecayWarningBanner', () => {
  beforeEach(() => {
    walletState.address = 'GCONNECTED';
    useReputationDecayMock.mockReset();
    useReputationDecayMock.mockReturnValue({
      isDecaying: true,
      projectedScore30Days: 42.3,
      currentScore: 80,
      loading: false,
    });
    window.localStorage.clear();
  });

  it('renders nothing when no wallet is connected', () => {
    walletState.address = null;
    const { container } = render(<DecayWarningBanner address="GCONNECTED" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when viewing a different address than the connected wallet', () => {
    const { container } = render(<DecayWarningBanner address="GSOMEONEELSE" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while loading', () => {
    useReputationDecayMock.mockReturnValue({
      isDecaying: true,
      projectedScore30Days: 0,
      currentScore: 0,
      loading: true,
    });
    const { container } = render(<DecayWarningBanner address="GCONNECTED" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when not decaying', () => {
    useReputationDecayMock.mockReturnValue({
      isDecaying: false,
      projectedScore30Days: 100,
      currentScore: 100,
      loading: false,
    });
    const { container } = render(<DecayWarningBanner address="GCONNECTED" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the decay warning with current and projected scores using the connected address as default target', async () => {
    render(<DecayWarningBanner />);
    expect(await screen.findByText(/Your reputation is decaying/)).toBeInTheDocument();
    expect(screen.getByText(/Current score: 80/)).toBeInTheDocument();
    expect(screen.getByText(/Projected score in 30 days: 42/)).toBeInTheDocument();
  });

  it('dismisses the banner and persists the dismissal timestamp', async () => {
    render(<DecayWarningBanner address="GCONNECTED" />);
    await screen.findByText(/Your reputation is decaying/);

    fireEvent.click(screen.getByLabelText('Dismiss decay warning'));

    expect(screen.queryByText(/Your reputation is decaying/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem('iln:dismissed-decay-warning')).not.toBeNull();
  });

  it('stays hidden on remount within 7 days of a prior dismissal', async () => {
    const now = Date.now();
    window.localStorage.setItem('iln:dismissed-decay-warning', now.toString());

    const { container } = render(<DecayWarningBanner address="GCONNECTED" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByText(/Your reputation is decaying/)).not.toBeInTheDocument();
  });

  it('shows again once the dismissal window has elapsed', async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem('iln:dismissed-decay-warning', eightDaysAgo.toString());

    render(<DecayWarningBanner address="GCONNECTED" />);
    expect(await screen.findByText(/Your reputation is decaying/)).toBeInTheDocument();
  });

  it('handles a localStorage write failure gracefully on dismiss', async () => {
    render(<DecayWarningBanner address="GCONNECTED" />);
    await screen.findByText(/Your reputation is decaying/);

    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => fireEvent.click(screen.getByLabelText('Dismiss decay warning'))).not.toThrow();
    spy.mockRestore();
  });
});
