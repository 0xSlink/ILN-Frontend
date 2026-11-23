import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubmitInvoiceForm from '../SubmitInvoiceForm';

const addToast = vi.fn(() => 'toast-id-1');
const updateToast = vi.fn();
const executeMock = vi.fn();

const walletState = {
  address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6',
  isConnected: true,
  isInstalled: true,
  error: null as string | null,
  networkMismatch: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  signTx: vi.fn(async () => 'signed-xdr'),
};

const protocolCapsMock = {
  data: {
    maxInvoiceAmount: 5_000_000_000n, // 5000 USDC in 6 decimals
    tokenVolumeCap: 50_000_000_000n,
    hasMaxInvoiceCap: true,
    hasVolumeCap: true,
    isRolloutCapped: true,
    formattedMaxInvoiceAmount: '5,000 USDC',
    formattedTokenVolumeCap: '50,000 USDC',
  },
  isLoading: false,
};

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn().mockResolvedValue(true),
  getAddress: vi.fn().mockResolvedValue({ address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6' }),
  setAllowed: vi.fn().mockResolvedValue(true),
  signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: 'signed-xdr' }),
  getNetwork: vi.fn().mockResolvedValue({ network: 'TESTNET' }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ addToast, updateToast }),
}));

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({ ...walletState }),
}));

vi.mock('../../hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({
    tokens: [{ symbol: 'USDC', decimals: 6, contractId: 'TOKEN_ID' }],
    tokenMap: new Map([['TOKEN_ID', { symbol: 'USDC', decimals: 6, contractId: 'TOKEN_ID' }]]),
    defaultToken: { symbol: 'USDC', decimals: 6, contractId: 'TOKEN_ID' },
    loading: false,
    error: null,
  }),
}));

vi.mock('../../hooks/useProtocolCaps', () => ({
  useProtocolCaps: () => protocolCapsMock,
}));

vi.mock('../../hooks/useTransaction', () => ({
  useTransaction: () => ({
    execute: executeMock,
    loading: false,
    error: null,
    signingModal: null,
  }),
}));

vi.mock('../../utils/soroban', () => ({
  submitInvoiceTransaction: vi.fn(),
  submitSignedTransaction: vi.fn(),
}));

const VALID_STELLAR_PAYER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function futureDueDate(daysAhead = 30) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

describe('SubmitInvoiceForm - Staged Rollout Caps Display and Error Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays contextual cap message under the amount field when cap is active', () => {
    render(<SubmitInvoiceForm />);

    const capNotice = screen.getByTestId('max-invoice-cap-note');
    expect(capNotice).toBeInTheDocument();
    expect(capNotice).toHaveTextContent('Maximum invoice amount during initial launch: 5,000 USDC');
  });

  it('shows validation error when entered amount exceeds the active launch cap', () => {
    render(<SubmitInvoiceForm />);

    const amountInput = screen.getByPlaceholderText('5000.00');
    fireEvent.change(amountInput, { target: { value: '6000' } });
    fireEvent.blur(amountInput);

    expect(
      screen.getByText('Invoice amount exceeds the maximum launch limit of 5,000 USDC.')
    ).toBeInTheDocument();
  });

  it('maps CapExceeded contract error to clear specific message upon submission failure', async () => {
    // When execute fails with CapExceeded message
    executeMock.mockResolvedValueOnce(null);

    // Render form with custom txError
    vi.mock('../../hooks/useTransaction', () => ({
      useTransaction: () => ({
        execute: vi.fn().mockResolvedValue(null),
        loading: false,
        error: 'CapExceeded: amount is above launch limit',
        signingModal: null,
      }),
    }));

    render(<SubmitInvoiceForm />);

    fireEvent.change(screen.getByPlaceholderText('G...'), {
      target: { value: VALID_STELLAR_PAYER },
    });
    fireEvent.change(screen.getByPlaceholderText('5000.00'), {
      target: { value: '4500' },
    });
    fireEvent.change(screen.getByLabelText(/due date/i), {
      target: { value: futureDueDate() },
    });

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Review & Submit
    const form = document.querySelector('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(
          'The invoice amount exceeds the current governance launch cap. Please reduce the invoice amount and try again.'
        )
      ).toBeInTheDocument();
    });
  });
});
