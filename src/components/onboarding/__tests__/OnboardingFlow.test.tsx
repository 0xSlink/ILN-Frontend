import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OnboardingFlow from '../OnboardingFlow';
import * as WalletContext from '../../../context/WalletContext';

// Mock Next router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('OnboardingFlow', () => {
  const mockWalletContext = {
    address: 'GABC123',
    isConnected: true,
    isInstalled: true,
    error: null,
    networkMismatch: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTx: vi.fn(),
  };

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(WalletContext, 'useWallet').mockReturnValue(mockWalletContext);

    // Mock getBoundingClientRect so Spotlight doesn't fail
    Element.prototype.getBoundingClientRect = vi.fn(() => {
      return {
        width: 100,
        height: 100,
        top: 0,
        left: 0,
        bottom: 100,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect;
    });

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not render if not connected', () => {
    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      ...mockWalletContext,
      isConnected: false,
      address: null,
    });
    render(<OnboardingFlow />);
    expect(screen.queryByText(/Welcome to ILN!/i)).not.toBeInTheDocument();
  });

  it('should not render if already completed', () => {
    localStorage.setItem('iln_onboarding_completed_GABC123', 'true');
    render(<OnboardingFlow />);
    expect(screen.queryByText(/Welcome to ILN!/i)).not.toBeInTheDocument();
  });

  it('should render role selection on first connect', () => {
    render(<OnboardingFlow />);
    expect(screen.getByText('Welcome to ILN!')).toBeInTheDocument();
    expect(screen.getByText("I'm a Freelancer")).toBeInTheDocument();
    expect(screen.getByText("I'm a Liquidity Provider")).toBeInTheDocument();
    expect(screen.getByText("I'm a Payer")).toBeInTheDocument();
  });

  it('should skip onboarding and save to local storage', () => {
    render(<OnboardingFlow />);
    const skipBtn = screen.getByText('Skip Onboarding');
    fireEvent.click(skipBtn);

    expect(localStorage.getItem('iln_onboarding_completed_GABC123')).toBe('true');
    expect(screen.queryByText(/Welcome to ILN!/i)).not.toBeInTheDocument();
  });

  it('should start freelancer flow', async () => {
    render(<OnboardingFlow />);

    // Select role
    fireEvent.click(screen.getByText("I'm a Freelancer"));

    // Check Step 1
    expect(screen.getByText('1 of 4')).toBeInTheDocument();
    expect(screen.getByText('Welcome to ILN!')).toBeInTheDocument();

    // Next Step
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
    expect(screen.getByText('Submit an Invoice')).toBeInTheDocument();

    // Skip mid-flow
    fireEvent.click(screen.getByText('Skip'));
    expect(localStorage.getItem('iln_onboarding_completed_GABC123')).toBe('true');
    expect(screen.queryByText('Submit an Invoice')).not.toBeInTheDocument();
  });

  it('should complete payer flow', () => {
    render(<OnboardingFlow />);

    fireEvent.click(screen.getByText("I'm a Payer"));

    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.getByText('How to Settle')).toBeInTheDocument();

    // Finish
    fireEvent.click(screen.getByText('Done'));
    expect(localStorage.getItem('iln_onboarding_completed_GABC123')).toBe('true');
    expect(screen.queryByText('How to Settle')).not.toBeInTheDocument();
  });
});
