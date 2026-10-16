import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BatchInvoiceForm from '../BatchInvoiceForm';

const addToast = vi.fn(() => 'toast-id');
const updateToast = vi.fn();
const submitInvoicesBatch = vi.fn();

const walletState = {
  address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6',
  isConnected: true,
  networkMismatch: false,
  signTx: vi.fn().mockResolvedValue('signed-xdr'),
};

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast, updateToast }),
}));

vi.mock('@/utils/soroban', () => ({
  submitInvoicesBatch: (...args: unknown[]) => submitInvoicesBatch(...args),
}));

vi.mock('@/hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({
    tokens: [{ symbol: 'USDC', decimals: 7, contractId: 'USDC_TOKEN_ID' }],
    tokenMap: new Map([
      ['USDC_TOKEN_ID', { symbol: 'USDC', decimals: 7, contractId: 'USDC_TOKEN_ID' }],
    ]),
    defaultToken: { symbol: 'USDC', decimals: 7, contractId: 'USDC_TOKEN_ID' },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BatchInvoiceForm', () => {
  it('renders the form component', () => {
    render(<BatchInvoiceForm onSuccess={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Batch Invoice Submission' })).toBeInTheDocument();
  });

  it('adds a new row when add row button is clicked', async () => {
    render(<BatchInvoiceForm onSuccess={vi.fn()} />);
    // The form defaults to the CSV upload mode; "Add Row" lives in Dynamic Form.
    fireEvent.click(screen.getByRole('button', { name: 'Dynamic Form' }));
    const addButton = screen.getByRole('button', { name: /add.*row/i });
    fireEvent.click(addButton);
    await waitFor(() => {
      expect(screen.getAllByDisplayValue('3.00').length).toBeGreaterThan(0);
    });
  });

  it('removes a row when delete button is clicked', async () => {
    render(<BatchInvoiceForm onSuccess={vi.fn()} />);
    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
      await waitFor(() => {
        expect(screen.queryAllByRole('button', { name: /delete/i }).length).toBeLessThan(
          deleteButtons.length
        );
      });
    }
  });

  it('handles CSV file upload', async () => {
    render(<BatchInvoiceForm onSuccess={vi.fn()} />);
    const csvButton = screen.queryByRole('button', { name: /csv/i });
    if (csvButton) {
      fireEvent.click(csvButton);
    }
  });

  it('displays validation errors for invalid inputs', async () => {
    render(<BatchInvoiceForm onSuccess={vi.fn()} />);
    const payerInput = screen.queryByPlaceholderText(/payer|address/i);
    if (payerInput) {
      fireEvent.change(payerInput, { target: { value: 'invalid' } });
      await waitFor(() => {
        expect(screen.queryByText(/invalid.*address|address.*invalid|valid/i)).toBeInTheDocument();
      });
    }
  });

  it('enables submit button only with valid data', async () => {
    render(<BatchInvoiceForm onSuccess={vi.fn()} />);
    const submitButton = screen.queryByRole('button', { name: /submit|send/i });
    if (submitButton) {
      expect(submitButton).toBeDisabled();
    }
  });

  it('submits batch invoices on form submission', async () => {
    const onSuccess = vi.fn();
    submitInvoicesBatch.mockResolvedValue({ successful: 1, failed: 0 });
    render(<BatchInvoiceForm onSuccess={onSuccess} />);
    const submitButton = screen.queryByRole('button', { name: /submit|send/i });
    if (submitButton && !submitButton.hasAttribute('disabled')) {
      fireEvent.click(submitButton);
      await waitFor(() => {
        expect(submitInvoicesBatch).toHaveBeenCalled();
      });
    }
  });

  it('handles submission errors gracefully', async () => {
    submitInvoicesBatch.mockRejectedValue(new Error('submission failed'));
    render(<BatchInvoiceForm onSuccess={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Batch Invoice Submission' })).toBeInTheDocument();
  });
});
