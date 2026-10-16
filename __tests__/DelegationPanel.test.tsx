import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DelegationPanel } from '@/components/governance/DelegationPanel';
import { useWallet } from '@/context/WalletContext';
import { useTransaction } from '@/hooks/useTransaction';
import { resolveFederatedAddress } from '@/utils/federation';

// Mock hooks and utils
vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: vi.fn(),
}));

vi.mock('@/utils/federation', () => ({
  resolveFederatedAddress: vi.fn(),
}));

vi.mock('@/utils/governance', () => ({
  // Relaxed so the panel's demo "known delegators" (short placeholder ids like
  // `GABC123...`) still resolve and can trigger the cycle check.
  isValidStellarAddress: vi.fn((addr: string) => addr.startsWith('G') && addr.length >= 8),
  getVotingPower: vi.fn().mockResolvedValue(1250),
}));

describe('DelegationPanel', () => {
  const mockExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useWallet as any).mockReturnValue({
      address: 'GUSER123',
      isConnected: true,
    });
    (useTransaction as any).mockReturnValue({
      execute: mockExecute,
      loading: false,
      error: null,
    });
    (resolveFederatedAddress as any).mockResolvedValue('GRESOLVED456');
  });

  it('renders weight and balance correctly', () => {
    render(<DelegationPanel />);
    expect(screen.getByText('1700 ILN')).toBeDefined(); // 1250 + 450
    expect(screen.getByText('1250 ILN')).toBeDefined();
    expect(screen.getByText('Self-voting')).toBeDefined();
  });

  it('resolves federation addresses', async () => {
    render(<DelegationPanel />);
    const input = screen.getByPlaceholderText(/Stellar address/);

    fireEvent.change(input, { target: { value: 'alice*stellar.org' } });

    await waitFor(() => {
      expect(resolveFederatedAddress).toHaveBeenCalledWith('alice*stellar.org');
      expect(screen.getByText(/Ready to delegate to GRESOLVED456/)).toBeDefined();
    });
  });

  it('detects delegation cycles', async () => {
    render(<DelegationPanel />);
    const input = screen.getByPlaceholderText(/Stellar address/);

    // Address that is mocked as a delegator to the user
    fireEvent.change(input, { target: { value: 'GABC123...' } });

    await waitFor(() => {
      expect(
        screen.getByText(/You cannot delegate to an address that delegates back to you/)
      ).toBeDefined();
    });
    expect(screen.getByRole('button', { name: /Delegate/ })).toBeDisabled();
  });

  it('handles delegation flow', async () => {
    mockExecute.mockResolvedValue(true);
    render(<DelegationPanel />);

    const input = screen.getByPlaceholderText(/Stellar address/);
    fireEvent.change(input, {
      target: { value: 'GVALID78901234567890123456789012345678901234567890123456' },
    });

    const button = screen.getByRole('button', { name: /Delegate/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalled();
      expect(screen.getByText(/Delegating to GVALID/)).toBeDefined();
      expect(screen.getByText(/Undelegate/)).toBeDefined();
    });
  });

  it('handles undelegation flow', async () => {
    mockExecute.mockResolvedValue(true);
    render(<DelegationPanel />);

    // First delegate
    const input = screen.getByPlaceholderText(/Stellar address/);
    fireEvent.change(input, {
      target: { value: 'GVALID78901234567890123456789012345678901234567890123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Delegate/ }));

    await waitFor(() => {
      expect(screen.getByText(/Undelegate/)).toBeDefined();
    });

    // Now undelegate
    fireEvent.click(screen.getByText(/Undelegate/));

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Self-voting')).toBeDefined();
    });
  });
});
