/**
 * @file SubmitInvoiceForm.test.tsx
 *
 * The form is a three-step wizard:
 *   1. Invoice details (payer / amount / due date / referral)
 *   2. Token & discount rate
 *   3. Review & submit
 *
 * Covers:
 *  - Field-level validation (surfaced on blur)
 *  - Wallet-not-connected and network-mismatch guards (block "Continue")
 *  - Successful submission flow (invoice ID + tx hash displayed)
 *  - Contract error reflected in the UI error banner
 *  - Submit button disabled while in-flight
 *  - Live yield preview reacts to amount / discount-rate changes
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubmitInvoiceForm from '../SubmitInvoiceForm';

// ─── Stable mock handles ────────────────────────────────────────────────────

const addToast = vi.fn(() => 'toast-id-1');
const updateToast = vi.fn();
const submitInvoiceTransaction = vi.fn();

/** Mutable wallet state shared across tests – reset in beforeEach. */
const walletState = {
  address: null as string | null,
  isConnected: false,
  isInstalled: true,
  error: null as string | null,
  networkMismatch: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  signTx: vi.fn(async () => 'signed-xdr'),
};

// ─── Module mocks ────────────────────────────────────────────────────────────

/** Mock Freighter API so no browser extension is required. */
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn().mockResolvedValue(false),
  getAddress: vi.fn().mockResolvedValue({ address: null }),
  setAllowed: vi.fn().mockResolvedValue(false),
  signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: 'signed-xdr' }),
  getNetwork: vi.fn().mockResolvedValue({ network: 'TESTNET' }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ addToast, updateToast }),
}));

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({ ...walletState }),
}));

vi.mock('../../utils/soroban', () => ({
  submitInvoiceTransaction: (...args: unknown[]) => submitInvoiceTransaction(...args),
  submitSignedTransaction: vi.fn(),
  getNativeXlmBalance: vi.fn(async () => 0n),
  getTokenBalance: vi.fn(async () => 0n),
}));

vi.mock('../../hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({
    tokens: [{ symbol: 'USDC', decimals: 7, contractId: 'TOKEN_ID' }],
    tokenMap: new Map([['TOKEN_ID', { symbol: 'USDC', decimals: 7, contractId: 'TOKEN_ID' }]]),
    defaultToken: { symbol: 'USDC', decimals: 7, contractId: 'TOKEN_ID' },
    loading: false,
    error: null,
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_STELLAR_PAYER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const VALID_STELLAR_FREELANCER = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6';

/** Due dates must be in the future and no more than 365 days out. */
function futureDueDate(daysAhead = 30) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

function connectWallet(address = VALID_STELLAR_FREELANCER) {
  walletState.address = address;
  walletState.isConnected = true;
}

function fillStep1({
  payer = VALID_STELLAR_PAYER,
  amount = '1000',
  dueDate = futureDueDate(),
}: { payer?: string; amount?: string; dueDate?: string } = {}) {
  fireEvent.change(screen.getByPlaceholderText('G...'), { target: { value: payer } });
  fireEvent.change(screen.getByPlaceholderText('5000.00'), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: dueDate } });
}

function clickContinue() {
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

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

  // ── Disconnected state ────────────────────────────────────────────────────

  it("renders the 'Connect Freighter wallet' button when disconnected", () => {
    render(<SubmitInvoiceForm />);
    expect(screen.getByRole('button', { name: /connect freighter wallet/i })).toBeInTheDocument();
  });

  it('blocks the wizard when the wallet is not connected', () => {
    render(<SubmitInvoiceForm />);
    fillStep1();

    // "Continue" stays disabled, so step 3 (and the submit button) is unreachable.
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    clickContinue();
    expect(screen.queryByRole('button', { name: /^submit invoice$/i })).not.toBeInTheDocument();
    expect(submitInvoiceTransaction).not.toHaveBeenCalled();
  });

  // ── Field validation ──────────────────────────────────────────────────────

  it('rejects an empty payer address', async () => {
    connectWallet();
    render(<SubmitInvoiceForm />);

    fireEvent.blur(screen.getByPlaceholderText('G...'));
    expect(await screen.findByText(/payer stellar address is required/i)).toBeInTheDocument();
  });

  it('rejects a payer address that is not a valid Stellar public key', async () => {
    connectWallet();
    render(<SubmitInvoiceForm />);

    const payerInput = screen.getByPlaceholderText('G...');
    fireEvent.change(payerInput, { target: { value: 'not-a-stellar-key' } });
    fireEvent.blur(payerInput);

    expect(await screen.findByText(/enter a valid stellar address/i)).toBeInTheDocument();
  });

  it('rejects a non-numeric invoice amount', async () => {
    connectWallet();
    render(<SubmitInvoiceForm />);

    const amountInput = screen.getByPlaceholderText('5000.00');
    fireEvent.change(amountInput, { target: { value: 'not-a-number' } });
    fireEvent.blur(amountInput);

    expect(await screen.findByText(/amount must be provided/i)).toBeInTheDocument();
  });

  it('rejects a zero invoice amount', async () => {
    connectWallet();
    render(<SubmitInvoiceForm />);

    const amountInput = screen.getByPlaceholderText('5000.00');
    fireEvent.change(amountInput, { target: { value: '0' } });
    fireEvent.blur(amountInput);

    expect(await screen.findByText(/amount must be between 0 and 10,000,000/i)).toBeInTheDocument();
  });

  it('rejects a due date that is missing', async () => {
    connectWallet();
    render(<SubmitInvoiceForm />);

    fireEvent.blur(screen.getByLabelText(/due date/i));
    expect(await screen.findByText(/select a valid due date/i)).toBeInTheDocument();
  });

  it('rejects a discount rate of 0', async () => {
    connectWallet();
    render(<SubmitInvoiceForm />);

    fillStep1();
    clickContinue();

    const discountInput = screen.getByPlaceholderText('3.00');
    fireEvent.change(discountInput, { target: { value: '0' } });
    fireEvent.blur(discountInput);

    expect(
      await screen.findByText(/discount rate must be between 1% and 50%/i)
    ).toBeInTheDocument();
  });

  it('rejects a discount rate above 50%', async () => {
    connectWallet();
    render(<SubmitInvoiceForm />);

    fillStep1();
    clickContinue();

    const discountInput = screen.getByPlaceholderText('3.00');
    fireEvent.change(discountInput, { target: { value: '51' } });
    fireEvent.blur(discountInput);

    expect(
      await screen.findByText(/discount rate must be between 1% and 50%/i)
    ).toBeInTheDocument();
  });

  // ── Network mismatch guard ────────────────────────────────────────────────

  it('blocks the wizard when the wallet is on the wrong network', () => {
    connectWallet();
    walletState.networkMismatch = true;
    render(<SubmitInvoiceForm />);

    fillStep1();

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    expect(submitInvoiceTransaction).not.toHaveBeenCalled();
  });

  it("renders the 'Wrong network' badge in the wallet panel when networkMismatch is true", () => {
    connectWallet();
    walletState.networkMismatch = true;
    render(<SubmitInvoiceForm />);

    expect(screen.getByText('Wrong network')).toBeInTheDocument();
  });

  // ── Live yield preview ────────────────────────────────────────────────────

  it('updates the live yield preview as the user types amount and discount rate', () => {
    connectWallet();
    render(<SubmitInvoiceForm />);

    fillStep1({ amount: '10000' });
    clickContinue();
    fireEvent.change(screen.getByPlaceholderText('3.00'), { target: { value: '5' } });

    // Face value
    expect(screen.getAllByText('10,000 USDC').length).toBeGreaterThan(0);
    // Freelancer payout
    expect(screen.getAllByText('9,500 USDC').length).toBeGreaterThan(0);
    // LP yield
    expect(screen.getAllByText('500 USDC').length).toBeGreaterThan(0);
  });

  it('resets the preview to zero when an invalid amount is entered', () => {
    render(<SubmitInvoiceForm />);

    fireEvent.change(screen.getByPlaceholderText('5000.00'), { target: { value: 'abc' } });

    // All amounts should show 0 (Face value, Payout, LP Yield, and sometimes a hint)
    expect(screen.getAllByText('0 USDC').length).toBeGreaterThanOrEqual(3);
  });

  // ── Successful submission ─────────────────────────────────────────────────

  it('submits a fully valid invoice and displays the returned invoice ID and tx hash', async () => {
    connectWallet();
    submitInvoiceTransaction.mockResolvedValue({ invoiceId: 99n, txHash: 'deadbeef' });

    render(<SubmitInvoiceForm />);

    fillStep1({ amount: '2000' });
    clickContinue();
    fireEvent.change(screen.getByPlaceholderText('3.00'), { target: { value: '3.5' } });
    clickContinue();
    fireEvent.click(screen.getByRole('button', { name: /submit invoice/i }));

    // Contract call is made with correctly parsed values
    await waitFor(() => {
      expect(submitInvoiceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          freelancer: VALID_STELLAR_FREELANCER,
          payer: VALID_STELLAR_PAYER,
          amount: 2_000_000_000n, // 2000 USDC at 6 input decimals
          discountRate: 350, // 3.5% → 350 bps
        })
      );
    });

    // Success banner with invoice ID
    expect(await screen.findByText('Returned invoice ID')).toBeInTheDocument();
    expect(screen.getByText('#99')).toBeInTheDocument();
    expect(screen.getByText(/Transaction hash: deadbeef/)).toBeInTheDocument();
  });

  it('disables the submit button while the transaction is in-flight', async () => {
    connectWallet();
    // Never-resolving promise keeps the button disabled for the assertion
    submitInvoiceTransaction.mockReturnValue(new Promise(() => {}));

    render(<SubmitInvoiceForm />);

    fillStep1({ amount: '500' });
    clickContinue();
    clickContinue();
    fireEvent.click(screen.getByRole('button', { name: /submit invoice/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /submitting invoice/i })).toBeDisabled()
    );
  });

  // ── Error states ──────────────────────────────────────────────────────────

  it('shows an error banner and an error toast when the contract call fails', async () => {
    connectWallet();
    submitInvoiceTransaction.mockRejectedValue(new Error('contract: insufficient gas'));

    render(<SubmitInvoiceForm />);

    fillStep1({ amount: '1000' });
    clickContinue();
    clickContinue();
    fireEvent.click(screen.getByRole('button', { name: /submit invoice/i }));

    expect(
      await screen.findByText('The transaction did not complete successfully.')
    ).toBeInTheDocument();
    expect(updateToast).toHaveBeenCalledWith(
      'toast-id-1',
      expect.objectContaining({ type: 'error' })
    );
  });

  it('calls addToast with a pending toast on submit then updates it on success', async () => {
    connectWallet();
    submitInvoiceTransaction.mockResolvedValue({ invoiceId: 7n, txHash: '0xabc' });

    render(<SubmitInvoiceForm />);

    fillStep1({ amount: '1200' });
    clickContinue();
    clickContinue();
    fireEvent.click(screen.getByRole('button', { name: /submit invoice/i }));

    await waitFor(() => expect(updateToast).toHaveBeenCalled());

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'pending',
        title: expect.stringMatching(/submitting invoice/i),
      })
    );
    expect(updateToast).toHaveBeenCalledWith(
      'toast-id-1',
      expect.objectContaining({ type: 'success', title: 'Invoice submitted' })
    );
  });

  // ── Connected state ───────────────────────────────────────────────────────

  it("renders the wallet address and 'Disconnect' button when connected", () => {
    connectWallet(VALID_STELLAR_FREELANCER);
    render(<SubmitInvoiceForm />);

    expect(screen.getByText(VALID_STELLAR_FREELANCER)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('calls disconnect when the Disconnect button is clicked', () => {
    connectWallet(VALID_STELLAR_FREELANCER);
    render(<SubmitInvoiceForm />);

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    expect(walletState.disconnect).toHaveBeenCalledOnce();
  });
});
