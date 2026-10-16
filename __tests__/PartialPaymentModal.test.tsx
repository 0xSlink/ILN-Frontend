import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PartialPaymentModal from '../src/components/PartialPaymentModal';
import { Invoice, TokenMetadata } from '../src/utils/soroban';

// Mock utilities
vi.mock('../src/utils/format', () => ({
  formatTokenAmount: (v: bigint, token?: TokenMetadata) => {
    if (!token) return v.toString();
    return (Number(v) / 10 ** token.decimals).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: token.decimals,
    });
  },
  tokenAmountToNumber: (v: bigint, token?: { decimals: number }) =>
    Number(v) / 10 ** (token?.decimals ?? 7),
  formatAddress: (a: string) => a.slice(0, 4),
}));

describe('PartialPaymentModal', () => {
  const mockInvoice: Invoice = {
    id: 123n,
    status: 'Funded',
    freelancer: 'FREELANCER',
    payer: 'PAYER',
    amount: 10000000000n, // 1000 USDC (in stroops: 7 decimals)
    amount_paid: 3000000000n, // 300 USDC already paid
    due_date: 999999n,
    discount_rate: 500,
    funder: 'LP_HOLDER',
  };

  const mockToken: TokenMetadata = {
    contractId: 'TOKEN_ID',
    name: 'USDC',
    symbol: 'USDC',
    decimals: 7,
  };

  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Payment Progress Display', () => {
    it('displays correct payment progress', () => {
      render(
        <PartialPaymentModal
          invoice={mockInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={false}
        />
      );

      // Should show payment progress: 300 / 1000
      expect(screen.getByText(/Payment Progress/)).toBeInTheDocument();
      expect(screen.getByText(/300\.00 \/ 1,000\.00 USDC/)).toBeInTheDocument();
      expect(screen.getByText(/Remaining: 700\.00 USDC/)).toBeInTheDocument();
    });

    it('updates progress when no amount paid yet', () => {
      const newInvoice = { ...mockInvoice, amount_paid: 0n };
      render(
        <PartialPaymentModal
          invoice={newInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={false}
        />
      );

      expect(screen.getByText(/0\.00 \/ 1,000\.00 USDC/)).toBeInTheDocument();
      expect(screen.getByText(/Remaining: 1,000\.00 USDC/)).toBeInTheDocument();
    });
  });

  describe('Amount Input Validation', () => {
    it('validates amount greater than 0', async () => {
      render(
        <PartialPaymentModal
          invoice={mockInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={false}
        />
      );

      const input = screen.getByPlaceholderText('0.00');
      fireEvent.change(input, { target: { value: '0' } });

      // Confirm is blocked up-front for a zero amount.
      const confirmBtn = screen.getByText('Confirm Payment');
      expect(confirmBtn).toBeDisabled();

      fireEvent.click(confirmBtn);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('validates amount does not exceed remaining balance', async () => {
      render(
        <PartialPaymentModal
          invoice={mockInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={false}
        />
      );

      const input = screen.getByPlaceholderText('0.00');
      fireEvent.change(input, { target: { value: '800' } }); // Exceeds remaining 700

      // Confirm is blocked up-front when the amount exceeds the remainder.
      const confirmBtn = screen.getByText('Confirm Payment');
      expect(confirmBtn).toBeDisabled();

      fireEvent.click(confirmBtn);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('allows payment up to remaining balance', async () => {
      render(
        <PartialPaymentModal
          invoice={mockInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={false}
        />
      );

      const input = screen.getByPlaceholderText('0.00');
      fireEvent.change(input, { target: { value: '700' } }); // Exactly the remaining amount

      const confirmBtn = screen.getByText('Confirm Payment');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith(7000000000n); // 700 USDC in stroops
      });
    });
  });

  describe('Pay Full Amount Shortcut', () => {
    it('populates input with full remaining amount', () => {
      render(
        <PartialPaymentModal
          invoice={mockInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={false}
        />
      );

      const fullPayBtn = screen.getByText(/Pay Full Remaining Amount/);
      fireEvent.click(fullPayBtn);

      // The shortcut fills a bare numeric value so <input type="number"> parses it.
      const input = screen.getByPlaceholderText('0.00') as HTMLInputElement;
      expect(input.value).toBe('700');
    });

    it('disables full payment button when no remaining balance', () => {
      const paidInvoice = { ...mockInvoice, amount_paid: mockInvoice.amount };
      render(
        <PartialPaymentModal
          invoice={paidInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={false}
        />
      );

      const fullPayBtn = screen.getByText(/Pay Full Remaining Amount/);
      expect(fullPayBtn).toBeDisabled();
    });
  });

  describe('Payment Summary', () => {
    it('displays new balance after payment', async () => {
      render(
        <PartialPaymentModal
          invoice={mockInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={false}
        />
      );

      const input = screen.getByPlaceholderText('0.00');
      fireEvent.change(input, { target: { value: '200' } });

      await waitFor(() => {
        expect(screen.getByText(/New Balance After Payment/)).toBeInTheDocument();
        expect(screen.getByText(/500\.00 USDC/)).toBeInTheDocument(); // 700 - 200 = 500
      });
    });
  });

  describe('Modal Behavior', () => {
    it('does not render when closed', () => {
      const { container } = render(
        <PartialPaymentModal
          invoice={mockInvoice}
          token={mockToken}
          isOpen={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('calls onClose when cancel button is clicked', () => {
      render(
        <PartialPaymentModal
          invoice={mockInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={false}
        />
      );

      const cancelBtn = screen.getByText('Cancel');
      fireEvent.click(cancelBtn);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
      render(
        <PartialPaymentModal
          invoice={mockInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={false}
        />
      );

      const closeBtn = screen
        .getAllByRole('button')
        .find((btn) =>
          btn.querySelector('.material-symbols-outlined')?.textContent?.includes('close')
        );
      if (closeBtn) fireEvent.click(closeBtn);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('disables buttons while submitting', () => {
      render(
        <PartialPaymentModal
          invoice={mockInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={true}
        />
      );

      const input = screen.getByPlaceholderText('0.00') as HTMLInputElement;
      expect(input).toBeDisabled();

      const confirmBtn = screen.getByText('Processing...');
      expect(confirmBtn).toBeDisabled();

      const cancelBtn = screen.getByText('Cancel');
      expect(cancelBtn).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('displays error message from onConfirm', async () => {
      const errorOnConfirm = vi.fn().mockRejectedValue(new Error('Transaction failed'));

      render(
        <PartialPaymentModal
          invoice={mockInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={errorOnConfirm}
          submitting={false}
        />
      );

      const input = screen.getByPlaceholderText('0.00');
      fireEvent.change(input, { target: { value: '100' } });

      const confirmBtn = screen.getByText('Confirm Payment');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText('Transaction failed')).toBeInTheDocument();
      });
    });

    it('clears the submission error when the user changes the input', async () => {
      mockOnConfirm.mockRejectedValueOnce(new Error('Payment rejected by wallet'));

      render(
        <PartialPaymentModal
          invoice={mockInvoice}
          token={mockToken}
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          submitting={false}
        />
      );

      const input = screen.getByPlaceholderText('0.00');
      fireEvent.change(input, { target: { value: '100' } });
      fireEvent.click(screen.getByText('Confirm Payment'));

      await waitFor(() => {
        expect(screen.getByText('Payment rejected by wallet')).toBeInTheDocument();
      });

      fireEvent.change(input, { target: { value: '200' } });

      await waitFor(() => {
        expect(screen.queryByText('Payment rejected by wallet')).not.toBeInTheDocument();
      });
    });
  });
});
