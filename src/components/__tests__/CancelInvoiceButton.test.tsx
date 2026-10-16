import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CancelInvoiceButton from '../CancelInvoiceButton';

const WALLET = 'GWALLETWALLETWALLETWALLETWALLETWALLETWALLETWALLETWXYZ';

function invoice(overrides: Partial<any> = {}) {
  return {
    id: 7n,
    freelancer: WALLET,
    payer: 'GPAYERPAYERPAYERPAYERPAYERPAYERPAYERPAYERPAYERPAYERZDS',
    amount: 1_000_000_000n,
    due_date: 1_900_000_000n,
    discount_rate: 300,
    status: 'Pending',
    token: '',
    ...overrides,
  };
}

const addToastMock = vi.fn(() => 'toast-id');
const updateToastMock = vi.fn();
const executeMock = vi.fn(async () => 'tx-hash-123');
const cancelInvoiceMock = vi.fn(async () => ({ tx: 'unsigned-xdr' }));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock, updateToast: updateToastMock }),
}));

vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: () => ({ execute: executeMock }),
}));

vi.mock('@/utils/soroban', () => ({
  cancelInvoice: (...args: unknown[]) => cancelInvoiceMock(...args),
}));

describe('CancelInvoiceButton', () => {
  beforeEach(() => {
    addToastMock.mockClear();
    updateToastMock.mockClear();
    executeMock.mockReset();
    executeMock.mockResolvedValue('tx-hash-123');
    cancelInvoiceMock.mockReset();
    cancelInvoiceMock.mockResolvedValue({ tx: 'unsigned-xdr' });
  });

  it('renders nothing when there is no connected wallet', () => {
    const { container } = render(<CancelInvoiceButton invoice={invoice()} walletAddress={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the invoice is not Pending', () => {
    const { container } = render(
      <CancelInvoiceButton invoice={invoice({ status: 'Funded' })} walletAddress={WALLET} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the connected wallet is not the freelancer', () => {
    const { container } = render(
      <CancelInvoiceButton invoice={invoice()} walletAddress="GSOMEONEELSE" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('matches the freelancer address case-insensitively', () => {
    render(<CancelInvoiceButton invoice={invoice()} walletAddress={WALLET.toLowerCase()} />);
    expect(screen.getByText('Cancel Invoice')).toBeInTheDocument();
  });

  it('opens and dismisses the confirmation dialog', () => {
    render(<CancelInvoiceButton invoice={invoice()} walletAddress={WALLET} />);

    fireEvent.click(screen.getByText('Cancel Invoice'));
    expect(screen.getByText('Are you sure? This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByText('Invoice #7')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Go back'));
    expect(screen.queryByText('Are you sure? This cannot be undone.')).not.toBeInTheDocument();
  });

  it('cancels the invoice, notifies success, and calls onCancelled', async () => {
    const onCancelled = vi.fn();
    render(
      <CancelInvoiceButton invoice={invoice()} walletAddress={WALLET} onCancelled={onCancelled} />
    );

    fireEvent.click(screen.getByText('Cancel Invoice'));
    fireEvent.click(screen.getByText('Confirm Cancel'));

    await waitFor(() => {
      expect(onCancelled).toHaveBeenCalledWith(expect.objectContaining({ status: 'Cancelled' }));
    });
    expect(cancelInvoiceMock).toHaveBeenCalledWith(WALLET, 7n);
    expect(executeMock).toHaveBeenCalledWith('unsigned-xdr', 'Cancel invoice');
    expect(updateToastMock).toHaveBeenCalledWith(
      'toast-id',
      expect.objectContaining({
        type: 'success',
        title: 'Invoice cancelled',
        txHash: 'tx-hash-123',
      })
    );
    expect(screen.queryByText('Are you sure? This cannot be undone.')).not.toBeInTheDocument();
  });

  it('shows an error toast and keeps the dialog open when the transaction is not submitted', async () => {
    executeMock.mockResolvedValue(null);
    render(<CancelInvoiceButton invoice={invoice()} walletAddress={WALLET} />);

    fireEvent.click(screen.getByText('Cancel Invoice'));
    fireEvent.click(screen.getByText('Confirm Cancel'));

    await waitFor(() => {
      expect(updateToastMock).toHaveBeenCalledWith(
        'toast-id',
        expect.objectContaining({
          type: 'error',
          title: 'Cancellation failed',
          message: 'Transaction was not submitted.',
        })
      );
    });
    expect(screen.getByText('Are you sure? This cannot be undone.')).toBeInTheDocument();
  });

  it('surfaces the error message when cancelInvoice throws', async () => {
    cancelInvoiceMock.mockRejectedValue(new Error('network unreachable'));
    render(<CancelInvoiceButton invoice={invoice()} walletAddress={WALLET} />);

    fireEvent.click(screen.getByText('Cancel Invoice'));
    fireEvent.click(screen.getByText('Confirm Cancel'));

    await waitFor(() => {
      expect(updateToastMock).toHaveBeenCalledWith(
        'toast-id',
        expect.objectContaining({ type: 'error', message: 'network unreachable' })
      );
    });
  });

  it('disables the dialog buttons while cancelling', async () => {
    let resolveExecute: (value: string) => void;
    executeMock.mockReturnValue(
      new Promise((resolve) => {
        resolveExecute = resolve;
      })
    );
    render(<CancelInvoiceButton invoice={invoice()} walletAddress={WALLET} />);

    fireEvent.click(screen.getByText('Cancel Invoice'));
    fireEvent.click(screen.getByText('Confirm Cancel'));

    await waitFor(() => {
      expect(screen.getByText('Cancelling...')).toBeInTheDocument();
    });
    expect(screen.getByText('Go back')).toBeDisabled();
    expect(screen.getByText('Cancelling...').closest('button')).toBeDisabled();

    resolveExecute!('tx-hash-999');
    await waitFor(() => {
      expect(screen.queryByText('Are you sure? This cannot be undone.')).not.toBeInTheDocument();
    });
  });

  it('uses the compact button styling when compact is set', () => {
    render(<CancelInvoiceButton invoice={invoice()} walletAddress={WALLET} compact />);
    expect(screen.getByText('Cancel Invoice').closest('button')).toHaveClass('w-full');
  });
});
