import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import VotingPowerDisplay from '@/components/VotingPowerDisplay';
import { useWallet } from '@/context/WalletContext';
import * as governanceUtils from '@/utils/governance';

// Mock dependencies
vi.mock('@/context/WalletContext');
vi.mock('@/utils/governance');

const mockUseWallet = vi.mocked(useWallet);
const mockGetDelegationInfo = vi.mocked(governanceUtils.getDelegationInfo);

describe('VotingPowerDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows connect wallet message when not connected', () => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTx: vi.fn(),
      networkMismatch: false,
      error: null,
    });

    render(<VotingPowerDisplay votingPower={0} />);

    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    expect(screen.getByText('Connect your wallet to view voting power')).toBeInTheDocument();
  });

  it('displays voting power when connected', async () => {
    mockUseWallet.mockReturnValue({
      address: 'GTEST123',
      isConnected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTx: vi.fn(),
      networkMismatch: false,
      error: null,
    });

    mockGetDelegationInfo.mockResolvedValue({
      delegatedTo: null,
      delegatedAmount: 0,
      incomingDelegations: 0,
    });

    render(<VotingPowerDisplay votingPower={1250} />);

    // The panel renders a skeleton until the delegation lookup resolves.
    await waitFor(() => {
      expect(screen.getByText('Your Voting Power')).toBeInTheDocument();
      expect(screen.getAllByText('1,250 ILN').length).toBeGreaterThan(0);
    });
  });

  it('shows delegation information when user has delegated', async () => {
    mockUseWallet.mockReturnValue({
      address: 'GTEST123',
      isConnected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTx: vi.fn(),
      networkMismatch: false,
      error: null,
    });

    mockGetDelegationInfo.mockResolvedValue({
      delegatedTo: 'GDEF456EXAMPLE789ABC012GHI345JKL678MNO901PQR234STU567VWX890YZ',
      delegatedAmount: 500,
      incomingDelegations: 0,
    });

    render(<VotingPowerDisplay votingPower={1250} />);

    await waitFor(() => {
      expect(screen.getByText('Your voting power is currently delegated to:')).toBeInTheDocument();
      expect(screen.getByText('GDEF456E...VWX890YZ')).toBeInTheDocument();
    });
  });

  it('shows incoming delegations', async () => {
    mockUseWallet.mockReturnValue({
      address: 'GTEST123',
      isConnected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTx: vi.fn(),
      networkMismatch: false,
      error: null,
    });

    mockGetDelegationInfo.mockResolvedValue({
      delegatedTo: null,
      delegatedAmount: 0,
      incomingDelegations: 500,
    });

    render(<VotingPowerDisplay votingPower={1750} />);

    await waitFor(() => {
      expect(screen.getByText('Delegated to you:')).toBeInTheDocument();
      // The "+" sign and the amount are separate text nodes.
      expect(screen.getByText(/\+\s*500 ILN/)).toBeInTheDocument();
    });
  });

  it('shows no voting power message when power is 0', async () => {
    mockUseWallet.mockReturnValue({
      address: 'GTEST123',
      isConnected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTx: vi.fn(),
      networkMismatch: false,
      error: null,
    });

    mockGetDelegationInfo.mockResolvedValue({
      delegatedTo: null,
      delegatedAmount: 0,
      incomingDelegations: 0,
    });

    render(<VotingPowerDisplay votingPower={0} />);

    await waitFor(() => {
      expect(screen.getByText('No voting power')).toBeInTheDocument();
      expect(screen.getByText(/You need ILN tokens to participate/)).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    mockUseWallet.mockReturnValue({
      address: 'GTEST123',
      isConnected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTx: vi.fn(),
      networkMismatch: false,
      error: null,
    });

    // Don't resolve the promise to keep loading state
    mockGetDelegationInfo.mockReturnValue(new Promise(() => {}));

    render(<VotingPowerDisplay votingPower={1250} />);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('includes links to delegation management', async () => {
    mockUseWallet.mockReturnValue({
      address: 'GTEST123',
      isConnected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTx: vi.fn(),
      networkMismatch: false,
      error: null,
    });

    mockGetDelegationInfo.mockResolvedValue({
      delegatedTo: null,
      delegatedAmount: 0,
      incomingDelegations: 0,
    });

    render(<VotingPowerDisplay votingPower={1250} />);

    await waitFor(() => {
      expect(screen.getByText('Manage Delegation')).toBeInTheDocument();
      expect(screen.getByText('Create Proposal')).toBeInTheDocument();
    });
  });
});
