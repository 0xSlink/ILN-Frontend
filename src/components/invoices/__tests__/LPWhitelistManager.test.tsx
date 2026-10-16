import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LPWhitelistManager from '../LPWhitelistManager';
import * as soroban from '@/utils/soroban';
import * as federation from '@/utils/federation';

// Mock utilities
vi.mock('@/utils/soroban', async () => {
  const actual = await vi.importActual('@/utils/soroban');
  return {
    ...actual,
    getReputation: vi.fn(),
    updateLPWhitelist: vi.fn(),
  };
});

vi.mock('@/utils/federation', async () => {
  return {
    resolveStellarAddressFromName: vi.fn(),
  };
});

describe('LPWhitelistManager', () => {
  const defaultProps = {
    invoiceId: '123',
    submitterAddress: 'GABCD123',
    currentWallet: 'GABCD123',
    status: 'Pending',
    whitelist: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (soroban.getReputation as any).mockResolvedValue({ score: 90 });
    // Reset the `updateLPWhitelist` mock to be present and callable
    (soroban as any).updateLPWhitelist = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render if the user is not the submitter', () => {
    const { container } = render(
      <LPWhitelistManager {...defaultProps} currentWallet="GOTHER456" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render if the invoice status is not Pending', () => {
    const { container } = render(<LPWhitelistManager {...defaultProps} status="Funded" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders empty state initially', async () => {
    render(<LPWhitelistManager {...defaultProps} />);
    expect(screen.getByText('Manage LP Whitelist')).toBeInTheDocument();
    expect(screen.getByText('No LPs are currently whitelisted.')).toBeInTheDocument();
    expect(screen.getByText('(0 / 10)')).toBeInTheDocument();
  });

  it('renders existing whitelist with reputations', async () => {
    (soroban.getReputation as any)
      .mockResolvedValueOnce({ score: 92 })
      .mockResolvedValueOnce({ score: 81 });

    render(
      <LPWhitelistManager {...defaultProps} whitelist={['GABCDEFGHIJKL123456', 'GDEF...456']} />
    );

    // The list is populated by an async effect, so wait for it to settle.
    await waitFor(() => {
      // Reputations should be loaded
      expect(screen.getByText('Reputation: 92')).toBeInTheDocument();
      expect(screen.getByText('Reputation: 81')).toBeInTheDocument();
    });

    // Should not display empty state
    expect(screen.queryByText('No LPs are currently whitelisted.')).not.toBeInTheDocument();
  });

  it('shows governance fallback if contract support is missing', async () => {
    // Delete the mock to simulate Scenario B
    delete (soroban as any).updateLPWhitelist;

    render(<LPWhitelistManager {...defaultProps} />);

    expect(
      screen.getByText('Whitelist modification is not currently supported by the protocol.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Request Governance Proposal/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add LP' })).not.toBeInTheDocument();
  });

  it('handles valid Stellar address addition optimistically', async () => {
    const user = userEvent.setup();
    render(<LPWhitelistManager {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Stellar Address or federation name/i);
    const addButton = screen.getByRole('button', { name: 'Add LP' });

    // Valid public key
    const validKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    await user.type(input, validKey);
    await user.click(addButton);

    await waitFor(() => {
      expect((soroban as any).updateLPWhitelist).toHaveBeenCalledWith({
        invoiceId: 123n,
        whitelist: [validKey],
      });
      expect(screen.getByText('LP added successfully.')).toBeInTheDocument();
    });
  });

  it('handles federation name resolution correctly', async () => {
    const user = userEvent.setup();
    const resolvedKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    (federation.resolveStellarAddressFromName as any).mockResolvedValue(resolvedKey);

    render(<LPWhitelistManager {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Stellar Address or federation name/i);
    await user.type(input, 'alice*lobstr.co');
    await user.click(screen.getByRole('button', { name: 'Add LP' }));

    await waitFor(() => {
      expect(federation.resolveStellarAddressFromName).toHaveBeenCalledWith('alice*lobstr.co');
      expect((soroban as any).updateLPWhitelist).toHaveBeenCalledWith({
        invoiceId: 123n,
        whitelist: [resolvedKey],
      });
    });
  });

  it('prevents duplicate LP additions', async () => {
    const validKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const user = userEvent.setup();
    render(<LPWhitelistManager {...defaultProps} whitelist={[validKey]} />);
    // Wait for the async reputation load to populate the local whitelist.
    await screen.findByText('Reputation: 90');

    const input = screen.getByPlaceholderText(/Stellar Address or federation name/i);
    await user.type(input, validKey);
    await user.click(screen.getByRole('button', { name: 'Add LP' }));

    await waitFor(() => {
      expect(screen.getByText('Address is already whitelisted.')).toBeInTheDocument();
      expect((soroban as any).updateLPWhitelist).not.toHaveBeenCalled();
    });
  });

  it('enforces whitelist limits', async () => {
    const fullWhitelist = Array(10)
      .fill(0)
      .map((_, i) => `G${i}CDEFGHIJKL123456`);
    render(<LPWhitelistManager {...defaultProps} whitelist={fullWhitelist} />);

    expect(await screen.findByText('Maximum whitelist size reached.')).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/Stellar Address or federation name/i);
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add LP' })).toBeDisabled();
  });

  it('shows limit approaching warning', async () => {
    const approachingLimitWhitelist = Array(8)
      .fill(0)
      .map((_, i) => `G${i}CDEFGHIJKL123456`);
    render(<LPWhitelistManager {...defaultProps} whitelist={approachingLimitWhitelist} />);

    expect(await screen.findByText('Approaching whitelist limit')).toBeInTheDocument();
  });

  it('handles LP removal successfully', async () => {
    const validKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const user = userEvent.setup();
    render(<LPWhitelistManager {...defaultProps} whitelist={[validKey]} />);
    await screen.findByText('Reputation: 90');

    // Click remove
    const removeButton = await screen.findByRole('button', {
      name: new RegExp(`Remove ${validKey}`, 'i'),
    });
    await user.click(removeButton);

    // Confirm dialog should appear
    expect(screen.getByText('Remove LP from whitelist?')).toBeInTheDocument();

    // Click confirm
    const confirmButton = screen.getByRole('button', { name: 'Remove' });
    await user.click(confirmButton);

    await waitFor(() => {
      expect((soroban as any).updateLPWhitelist).toHaveBeenCalledWith({
        invoiceId: 123n,
        whitelist: [],
      });
      expect(screen.getByText('LP removed successfully.')).toBeInTheDocument();
    });
  });
});
