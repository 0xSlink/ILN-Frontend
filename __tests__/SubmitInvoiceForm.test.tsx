import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubmitInvoiceForm from '@/components/SubmitInvoiceForm';

const approvedTokens = [
  { contractId: 'token-usdc', name: 'USD Coin', symbol: 'USDC', decimals: 7, iconLabel: 'US' },
  { contractId: 'token-eurc', name: 'Euro Coin', symbol: 'EURC', decimals: 7, iconLabel: 'EU' },
];

const addToast = vi.fn(() => 'toast-id');
const updateToast = vi.fn();
const submitInvoiceTransaction = vi.fn();

const walletState = {
  address: null as string | null,
  isConnected: false,
  isInstalled: true,
  error: null as string | null,
  networkMismatch: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  signTx: vi.fn(),
};

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    addToast,
    updateToast,
  }),
}));

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

vi.mock('@/hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({
    tokens: approvedTokens,
    tokenMap: new Map(approvedTokens.map((token) => [token.contractId, token])),
    defaultToken: approvedTokens[0],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/utils/soroban', () => ({
  submitInvoiceTransaction: (...args: unknown[]) => submitInvoiceTransaction(...args),
  submitSignedTransaction: vi.fn(),
  getNativeXlmBalance: vi.fn(async () => 0n),
  getTokenBalance: vi.fn(async () => 0n),
}));

const VALID_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

/** Due dates must be in the future and no more than 365 days out. */
function futureDueDate(daysAhead = 30) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

/** Fill step 1 of the wizard (payer / amount / due date). */
function fillStep1(amount: string) {
  fireEvent.change(screen.getByPlaceholderText('G...'), { target: { value: VALID_ADDRESS } });
  fireEvent.change(screen.getByPlaceholderText('5000.00'), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText('Due date'), { target: { value: futureDueDate() } });
}

function clickContinue() {
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
}

describe('SubmitInvoiceForm', () => {
  beforeEach(() => {
    walletState.address = null;
    walletState.isConnected = false;
    walletState.error = null;
    walletState.networkMismatch = false;
    walletState.connect.mockReset();
    walletState.disconnect.mockReset();
    walletState.signTx.mockReset();
    addToast.mockClear();
    updateToast.mockClear();
    submitInvoiceTransaction.mockReset();
  });

  it('updates the live yield preview as the user types', () => {
    walletState.address = VALID_ADDRESS;
    walletState.isConnected = true;

    render(<SubmitInvoiceForm />);

    fillStep1('5000');
    clickContinue();
    fireEvent.change(screen.getByPlaceholderText('3.00'), { target: { value: '4.5' } });

    expect(screen.getByText('Live yield preview')).toBeInTheDocument();
    expect(screen.getAllByText('5,000 USDC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4,775 USDC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('225 USDC').length).toBeGreaterThan(0);
  });

  it('blocks the wizard before submitting when Freighter is not connected', () => {
    render(<SubmitInvoiceForm />);

    fillStep1('1500');

    // "Continue" stays disabled, so the submit step is unreachable.
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    clickContinue();
    expect(screen.queryByText('Submit invoice')).not.toBeInTheDocument();
    expect(submitInvoiceTransaction).not.toHaveBeenCalled();
  });

  it('submits an invoice and displays the returned invoice id', async () => {
    walletState.address = VALID_ADDRESS;
    walletState.isConnected = true;

    submitInvoiceTransaction.mockResolvedValue({
      invoiceId: 42n,
      txHash: 'abc123',
    });

    render(<SubmitInvoiceForm />);

    fillStep1('1500');
    clickContinue();

    // TokenSelector is a custom listbox; the list renders twice (desktop
    // dropdown + mobile sheet), so take the first matching option.
    fireEvent.click(screen.getByRole('button', { expanded: false, name: /USDC/ }));
    fireEvent.click(screen.getAllByRole('option', { name: /EURC/ })[0]);

    fireEvent.change(screen.getByPlaceholderText('3.00'), { target: { value: '2.5' } });
    clickContinue();
    fireEvent.click(screen.getByText('Submit invoice'));

    await waitFor(() => {
      expect(submitInvoiceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          freelancer: walletState.address,
          payer: VALID_ADDRESS,
          amount: 1_500_000_000n, // 1500 at 6 input decimals
          discountRate: 250,
          token: 'token-eurc',
        })
      );
    });

    expect(await screen.findByText('Returned invoice ID')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText(/Transaction hash: abc123/)).toBeInTheDocument();
  });
});
