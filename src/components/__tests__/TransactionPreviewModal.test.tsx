import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TransactionPreviewModal from '../TransactionPreviewModal';
import type { DecodedTransaction } from '@/utils/decodeTransaction';

const mockDecoded: DecodedTransaction = {
  sourceAccount: 'GDJ4GRVMN5OS6LOT57YCT6LX532KIOVF6HRHX44WFNCD2K6JCMJPLORR',
  fee: '100',
  networkPassphrase: null,
  transactionType: 'unknown',
  operations: [
    {
      contract: 'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC',
      functionName: 'fund_invoice',
      args: [
        { name: 'arg0', value: 'GAAAA...', type: 'address' },
        { name: 'arg1', value: '42', type: 'u64' },
        { name: 'arg2', value: '10000000', type: 'i128' },
      ],
      rawArgs: [],
    },
  ],
};

describe('TransactionPreviewModal', () => {
  it('renders the modal with decoded transaction details', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <TransactionPreviewModal
        decoded={mockDecoded}
        rawXdr="AAAAAG..."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Transaction Preview')).toBeInTheDocument();
    expect(screen.getByText('fund_invoice')).toBeInTheDocument();
    expect(screen.getByText('Source Account:')).toBeInTheDocument();
    expect(screen.getByText('Transaction Fee:')).toBeInTheDocument();
    expect(screen.getByText('100 stroops')).toBeInTheDocument();
    expect(screen.getByText('1 Operation')).toBeInTheDocument();
  });

  it('shows warning when decoded is null (tampered/unrecognised payload)', () => {
    render(
      <TransactionPreviewModal
        decoded={null}
        rawXdr="AAAA..."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Unable to decode transaction')).toBeInTheDocument();
    expect(
      screen.getByText(/could not be decoded/)
    ).toBeInTheDocument();
  });

  it('shows a prominent warning when the decoded payload mismatches the expected UI action', () => {
    render(
      <TransactionPreviewModal
        decoded={mockDecoded}
        expectedAction="cast_vote"
        rawXdr="AAAA..."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Suspicious transaction pattern detected');
    expect(screen.getByText(/Expected cast_vote, but the payload calls fund_invoice/)).toBeInTheDocument();
  });

  it('calls onConfirm when Sign Transaction button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <TransactionPreviewModal
        decoded={mockDecoded}
        rawXdr="AAAA..."
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <TransactionPreviewModal
        decoded={mockDecoded}
        rawXdr="AAAA..."
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when close button (X) is clicked', () => {
    const onCancel = vi.fn();
    render(
      <TransactionPreviewModal
        decoded={mockDecoded}
        rawXdr="AAAA..."
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel transaction/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('displays multiple operations correctly', () => {
    const multiOp: DecodedTransaction = {
      ...mockDecoded,
      operations: [
        {
          ...mockDecoded.operations[0],
          functionName: 'approve',
        },
        {
          ...mockDecoded.operations[0],
          functionName: 'fund_invoice',
          args: [
            { name: 'arg0', value: 'GBBBB...', type: 'address' },
            { name: 'arg1', value: '10', type: 'u64' },
            { name: 'arg2', value: '5000000', type: 'i128' },
          ],
        },
      ],
    };

    render(
      <TransactionPreviewModal
        decoded={multiOp}
        rawXdr="AAAA..."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('2 Operations')).toBeInTheDocument();
    expect(screen.getByText('approve')).toBeInTheDocument();
    expect(screen.getByText('fund_invoice')).toBeInTheDocument();
  });

  it('renders raw XDR in expandable details section', () => {
    render(
      <TransactionPreviewModal
        decoded={mockDecoded}
        rawXdr="AAAAAGTESTXDRBASE64=="
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('View raw XDR (advanced)')).toBeInTheDocument();
  });

  it('displays security notice', () => {
    render(
      <TransactionPreviewModal
        decoded={mockDecoded}
        rawXdr="AAAA..."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Security notice:')).toBeInTheDocument();
  });

  it('shows operation arguments with type badges', () => {
    render(
      <TransactionPreviewModal
        decoded={mockDecoded}
        rawXdr="AAAA..."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Arguments:')).toBeInTheDocument();
    expect(screen.getByText('address')).toBeInTheDocument();
    expect(screen.getByText('u64')).toBeInTheDocument();
    expect(screen.getByText('i128')).toBeInTheDocument();
  });
});
