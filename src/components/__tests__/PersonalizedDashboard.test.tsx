import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PersonalizedDashboard from '../PersonalizedDashboard';

const walletState = { isConnected: true, roles: [] as string[], rolesLoading: false };
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

vi.mock('../ReferralWidget', () => ({
  default: () => <div data-testid="referral-widget" />,
}));

describe('PersonalizedDashboard', () => {
  beforeEach(() => {
    walletState.isConnected = true;
    walletState.roles = [];
    walletState.rolesLoading = false;
  });

  it('renders nothing when the wallet is not connected', () => {
    walletState.isConnected = false;
    const { container } = render(<PersonalizedDashboard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a role-detection indicator while roles are loading', () => {
    walletState.rolesLoading = true;
    render(<PersonalizedDashboard />);
    expect(screen.getByText('Detecting wallet roles...')).toBeInTheDocument();
  });

  it('marks the active role card for a role the wallet holds', () => {
    walletState.roles = ['lp'];
    render(<PersonalizedDashboard />);
    const lpCard = screen.getByText('Liquidity Provider').closest('a')!;
    expect(lpCard).toHaveTextContent('Active');
  });

  it('does not mark inactive role cards as active', () => {
    walletState.roles = ['lp'];
    render(<PersonalizedDashboard />);
    const freelancerCard = screen.getByText('Freelancer').closest('a')!;
    expect(freelancerCard).not.toHaveTextContent('Active');
  });

  it('shows all recommendations initially and dismisses one on click', () => {
    render(<PersonalizedDashboard />);
    expect(screen.getByText('Fund These Invoices')).toBeInTheDocument();
    expect(screen.getByText('Improve Reputation')).toBeInTheDocument();
    expect(screen.getByText('Optimize Yield')).toBeInTheDocument();

    const dismissButtons = screen.getAllByLabelText('Dismiss recommendation');
    fireEvent.click(dismissButtons[0]);

    expect(screen.queryByText('Fund These Invoices')).not.toBeInTheDocument();
    expect(screen.getByText('Improve Reputation')).toBeInTheDocument();
  });

  it('hides the recommendations section once all are dismissed', () => {
    render(<PersonalizedDashboard />);
    screen.getAllByLabelText('Dismiss recommendation').forEach((btn) => fireEvent.click(btn));
    expect(screen.queryByText('Recommended for you')).not.toBeInTheDocument();
  });

  it('renders the referral widget', () => {
    render(<PersonalizedDashboard />);
    expect(screen.getByTestId('referral-widget')).toBeInTheDocument();
  });
});
