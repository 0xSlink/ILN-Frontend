import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PartialPaymentModal from '../PartialPaymentModal';
import type { Invoice, TokenMetadata } from '@/utils/soroban';

const token: TokenMetadata = {
  contractId: 'CUSDC',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 7,
};

const baseInvoice: Invoice = {
  id: 42n,
  status: 'Funded',
  freelancer: 'GFREELANCER',
  payer: 'GPAYER',
  amount: 1_000_000_000n, // 100 USDC
  amount_paid: 300_000_000n, // 30 USDC
  due_date: 1_900_000_000n,
  discount_rate: 300,
  token: 'CUSDC',
};

describe('PartialPaymentModal', () => {
  it('blocks amounts exceeding remaining obligation and never renders a negative balance', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <PartialPaymentModal
        invoice={baseInvoice}
        token={token}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        submitting={false}
      />
    );

    const input = screen.getByLabelText('Payment Amount');
    fireEvent.change(input, { target: { value: '80' } });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Amount exceeds remaining balance. Maximum: 70 USDC'
    );
    expect(screen.getByRole('button', { name: 'Confirm Payment' })).toBeDisabled();
    expect(screen.getByText('0 USDC')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('parses decimal amounts without floating-point drift using exact BigInt units', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <PartialPaymentModal
        invoice={baseInvoice}
        token={token}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        submitting={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Payment Amount'), { target: { value: '19.99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Payment' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(199_900_000n);
    });
  });

  it('shows exact pending and confirmed reconciliation values', async () => {
    let resolveTx!: () => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveTx = resolve;
        })
    );

    render(
      <PartialPaymentModal
        invoice={baseInvoice}
        token={token}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        submitting={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Payment Amount'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Payment' }));

    expect(screen.getByRole('status')).toHaveTextContent('Payment Pending Confirmation');
    expect(screen.getByRole('status')).toHaveTextContent('Submitting: 25 USDC');
    expect(screen.getByRole('status')).toHaveTextContent('Expected Remaining Balance: 45 USDC');

    resolveTx();

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Payment Confirmed');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Paid: 25 USDC');
    expect(screen.getByRole('status')).toHaveTextContent('Remaining Obligation: 45 USDC');
  });

  it('shows exact attempted amount and unchanged obligation when payment fails', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Transaction rejected by wallet'));

    render(
      <PartialPaymentModal
        invoice={baseInvoice}
        token={token}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        submitting={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Payment Amount'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Payment' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Transaction rejected by wallet');
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Attempted: 25 USDC · Remaining obligation unchanged: 70 USDC'
    );
  });

  it('fills exact remaining balance when Pay Full Remaining Amount is clicked', () => {
    render(
      <PartialPaymentModal
        invoice={baseInvoice}
        token={token}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        submitting={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Pay Full Remaining Amount/i }));
    expect(screen.getByLabelText('Payment Amount')).toHaveValue(70);
  });
});
