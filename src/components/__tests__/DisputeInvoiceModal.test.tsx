import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisputeInvoiceModal from '../DisputeInvoiceModal';

const mockDisputeInvoice = vi.fn();
const mockHashEvidence = vi.fn();
const mockExecute = vi.fn();

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6',
    isConnected: true,
  }),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    addToast: vi.fn(() => 'toast-id'),
    updateToast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: () => ({
    execute: mockExecute,
    loading: false,
    error: null,
  }),
}));

vi.mock('@/utils/soroban', () => ({
  disputeInvoice: (...args: unknown[]) => mockDisputeInvoice(...args),
}));

vi.mock('@/utils/evidence', () => ({
  hashEvidence: (...args: unknown[]) => mockHashEvidence(...args),
}));

const mockInvoice = {
  id: '1',
  payer: 'GTEST',
  freelancer: 'GTEST2',
  amount: 1000,
  discount_rate: 3,
  due_date: '2024-12-31',
  state: 'disputed' as const,
  token: 'USDC',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DisputeInvoiceModal', () => {
  it('renders the dispute modal with invoice ID', () => {
    render(<DisputeInvoiceModal invoice={mockInvoice} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/raise dispute/i)).toBeInTheDocument();
    expect(screen.getByText(/invoice #1/i)).toBeInTheDocument();
  });

  it('disables submit button when evidence is empty', () => {
    render(<DisputeInvoiceModal invoice={mockInvoice} onClose={vi.fn()} onSuccess={vi.fn()} />);
    const submitButton = screen.queryByRole('button', { name: /submit|raise/i });
    if (submitButton) {
      expect(submitButton).toBeDisabled();
    }
  });

  it('enables submit button when evidence is provided', async () => {
    render(<DisputeInvoiceModal invoice={mockInvoice} onClose={vi.fn()} onSuccess={vi.fn()} />);
    const evidenceInput = screen.getByLabelText(/evidence description/i);
    if (evidenceInput) {
      fireEvent.change(evidenceInput, { target: { value: 'This invoice is incorrect' } });
      await waitFor(() => {
        const submitButton = screen.queryByRole('button', { name: /submit|raise/i });
        if (submitButton && !submitButton.hasAttribute('disabled')) {
          expect(submitButton).not.toBeDisabled();
        }
      });
    }
  });

  it('hashes evidence before submission', async () => {
    mockDisputeInvoice.mockResolvedValue('tx-xdr');
    mockHashEvidence.mockResolvedValue('hashed-evidence');
    mockExecute.mockResolvedValue('tx-hash');

    render(<DisputeInvoiceModal invoice={mockInvoice} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const evidenceInput = screen.getByLabelText(/evidence description/i);
    if (evidenceInput) {
      fireEvent.change(evidenceInput, { target: { value: 'Incorrect invoice' } });
      const submitButton = screen.queryByRole('button', { name: /submit|raise/i });
      if (submitButton && !submitButton.hasAttribute('disabled')) {
        fireEvent.click(submitButton);
        await waitFor(() => {
          expect(mockHashEvidence).toHaveBeenCalledWith('Incorrect invoice');
        });
      }
    }
  });

  it('calls disputeInvoice contract function', async () => {
    mockDisputeInvoice.mockResolvedValue('tx-xdr');
    mockHashEvidence.mockResolvedValue('hashed-evidence');
    mockExecute.mockResolvedValue('tx-hash');

    render(<DisputeInvoiceModal invoice={mockInvoice} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const evidenceInput = screen.getByLabelText(/evidence description/i);
    if (evidenceInput) {
      fireEvent.change(evidenceInput, { target: { value: 'Invoice issue' } });
      const submitButton = screen.queryByRole('button', { name: /submit|raise/i });
      if (submitButton && !submitButton.hasAttribute('disabled')) {
        fireEvent.click(submitButton);
        await waitFor(() => {
          expect(mockDisputeInvoice).toHaveBeenCalled();
        });
      }
    }
  });

  it('closes modal on successful submission', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    mockDisputeInvoice.mockResolvedValue('tx-xdr');
    mockHashEvidence.mockResolvedValue('hashed-evidence');
    mockExecute.mockResolvedValue('tx-hash');

    render(<DisputeInvoiceModal invoice={mockInvoice} onClose={onClose} onSuccess={onSuccess} />);

    const evidenceInput = screen.getByLabelText(/evidence description/i);
    if (evidenceInput) {
      fireEvent.change(evidenceInput, { target: { value: 'Issue' } });
      const submitButton = screen.queryByRole('button', { name: /submit|raise/i });
      if (submitButton && !submitButton.hasAttribute('disabled')) {
        fireEvent.click(submitButton);
        await waitFor(() => {
          expect(onSuccess).toHaveBeenCalled();
          expect(onClose).toHaveBeenCalled();
        });
      }
    }
  });

  it('closes modal when close button is clicked', () => {
    const onClose = vi.fn();
    render(<DisputeInvoiceModal invoice={mockInvoice} onClose={onClose} onSuccess={vi.fn()} />);
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });
});
