import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NetworkMismatchBanner from '@/components/NetworkMismatchBanner';

const mockUseWallet = vi.fn();

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => mockUseWallet(),
}));

function createMismatchDetails(
  overrides: Partial<{
    walletMismatch: boolean;
    rpcMismatch: boolean;
    walletNetwork: string;
    appNetwork: string;
    rpcUrl: string;
    rpcNetwork: string | null;
    appNetworkName: string;
  }> = {}
) {
  return {
    walletMismatch: true,
    rpcMismatch: false,
    walletNetwork: 'mainnet',
    appNetwork: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    rpcNetwork: 'testnet',
    appNetworkName: 'TESTNET',
    ...overrides,
  };
}

describe('NetworkMismatchBanner', () => {
  beforeEach(() => {
    mockUseWallet.mockReset();
  });

  it('renders nothing when wallet is not connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      networkMismatch: false,
      rpcMismatch: false,
      mismatchDetails: null,
      switchingNetwork: false,
      walletNetwork: null,
    });
    const { container } = render(<NetworkMismatchBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when networks match', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      networkMismatch: false,
      rpcMismatch: false,
      mismatchDetails: null,
      switchingNetwork: false,
      walletNetwork: 'testnet',
    });
    const { container } = render(<NetworkMismatchBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows warning when wallet network mismatches app config', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      networkMismatch: true,
      rpcMismatch: false,
      mismatchDetails: createMismatchDetails(),
      switchingNetwork: false,
      walletNetwork: 'mainnet',
    });
    render(<NetworkMismatchBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Network mismatch/i)).toBeInTheDocument();
    // The label is split across a <strong>, so assert on the alert's text.
    expect(screen.getByRole('alert')).toHaveTextContent(/wallet is on Mainnet/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/configured for Testnet/i);
  });

  it("shows RPC mismatch details when RPC URL doesn't match wallet", () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      networkMismatch: true,
      rpcMismatch: true,
      mismatchDetails: createMismatchDetails({ rpcMismatch: true, rpcNetwork: 'mainnet' }),
      switchingNetwork: false,
      walletNetwork: 'testnet',
    });
    render(<NetworkMismatchBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/RPC endpoint/i)).toBeInTheDocument();
  });

  it('renders a Switch Network button', () => {
    const switchNetwork = vi.fn();
    mockUseWallet.mockReturnValue({
      isConnected: true,
      networkMismatch: true,
      rpcMismatch: false,
      mismatchDetails: createMismatchDetails(),
      switchingNetwork: false,
      walletNetwork: 'mainnet',
      switchNetwork,
    });
    render(<NetworkMismatchBanner />);
    const btn = screen.getByRole('button', { name: /switch to testnet/i });
    expect(btn).toBeInTheDocument();
  });

  it('calls switchNetwork when button is clicked', async () => {
    const switchNetwork = vi.fn();
    mockUseWallet.mockReturnValue({
      isConnected: true,
      networkMismatch: true,
      rpcMismatch: false,
      mismatchDetails: createMismatchDetails(),
      switchingNetwork: false,
      walletNetwork: 'mainnet',
      switchNetwork,
    });
    render(<NetworkMismatchBanner />);
    const btn = screen.getByRole('button', { name: /switch to testnet/i });
    await userEvent.click(btn);
    expect(switchNetwork).toHaveBeenCalledOnce();
  });

  it('disables the button while switching', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      networkMismatch: true,
      rpcMismatch: false,
      mismatchDetails: createMismatchDetails(),
      switchingNetwork: true,
      walletNetwork: 'mainnet',
      switchNetwork: vi.fn(),
    });
    render(<NetworkMismatchBanner />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('hides when mismatch is resolved', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      networkMismatch: true,
      rpcMismatch: false,
      mismatchDetails: createMismatchDetails(),
      switchingNetwork: false,
      walletNetwork: 'mainnet',
    });
    const { rerender, container } = render(<NetworkMismatchBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    mockUseWallet.mockReturnValue({
      isConnected: true,
      networkMismatch: false,
      rpcMismatch: false,
      mismatchDetails: null,
      switchingNetwork: false,
      walletNetwork: 'testnet',
    });
    rerender(<NetworkMismatchBanner />);
    expect(container.firstChild).toBeNull();
  });
});
