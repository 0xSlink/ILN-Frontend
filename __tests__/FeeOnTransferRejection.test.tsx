import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({ address: 'GABC', isConnected: true }),
}));
vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: () => ({ execute: vi.fn(), loading: false, error: null }),
}));
vi.mock('@/utils/governance', () => ({
  fetchProtocolParameters: vi.fn().mockResolvedValue({
    feeRateBps: 30,
    maxDiscountRateBps: 500,
    acceptedTokens: [],
  }),
  createProposal: vi.fn(),
  isValidStellarAddress: (v: string) => v.length === 56,
  lookupToken: vi.fn(),
}));

import NewGovernanceProposalPage from '@/app/governance/new/page';
import { lookupToken } from '@/utils/governance';

const VALID_ADDR = 'G' + 'A'.repeat(55);

describe('Fee-on-transfer token rejection (#68)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces the contract error when the token lookup reports FeeOnTransferToken', async () => {
    (lookupToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Contract error: FeeOnTransferToken')
    );

    render(<NewGovernanceProposalPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'AddToken' } });

    const input = screen.getByPlaceholderText(/G\.\.\./);
    fireEvent.change(input, { target: { value: VALID_ADDR } });

    // The lookup is debounced (500ms) and the message is surfaced on blur.
    await waitFor(() => expect(lookupToken).toHaveBeenCalledWith(VALID_ADDR), { timeout: 2000 });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(
        screen.getByText(
          'This token implements fee-on-transfer and cannot be added to the ILN allowlist. Tokens must transfer the exact amount specified.'
        )
      ).toBeInTheDocument()
    );
  });

  it('renders the token address field for AddToken proposals', async () => {
    render(<NewGovernanceProposalPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'AddToken' } });

    expect(screen.getByText('Token Address (G...)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/G\.\.\./)).toBeInTheDocument();
  });

  it('shows generic error message for non-fee-on-transfer failures', async () => {
    (lookupToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Token not found'));

    render(<NewGovernanceProposalPage />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'AddToken' } });

    const input = screen.getByPlaceholderText(/G\.\.\./);
    fireEvent.change(input, { target: { value: VALID_ADDR } });

    await waitFor(() => expect(lookupToken).toHaveBeenCalledWith(VALID_ADDR), { timeout: 2000 });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.getByText('Token not found')).toBeInTheDocument());
  });
});
