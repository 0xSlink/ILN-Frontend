/**
 * @file SubmitInvoiceFormSubmit.test.tsx
 *
 * Covers the additions made for issue #11:
 *  - End-to-end multi-step submission (details → token/rate → review → submit)
 *  - Optional referral code captured and persisted as per-invoice attribution
 *  - Success surfaces the returned invoice ID + a "View invoice details" link
 *  - On success the freelancer is redirected to the invoice detail page
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRouter } from 'next/navigation';
import SubmitInvoiceForm from '../SubmitInvoiceForm';

const addToast = vi.fn(() => 'toast-id-1');
const updateToast = vi.fn();
const submitInvoiceTransaction = vi.fn();
const getTokenBalance = vi.fn().mockResolvedValue(0n);

const walletState = {
  address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6',
  isConnected: true,
  isInstalled: true,
  error: null as string | null,
  networkMismatch: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  signTx: vi.fn(),
};

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
  getTokenBalance: (...args: unknown[]) => getTokenBalance(...args),
}));

const TOKEN = { symbol: 'USDC', decimals: 7, contractId: 'TOKEN_ID', isAllowed: true };
vi.mock('../../hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({
    tokens: [TOKEN],
    tokenMap: new Map([['TOKEN_ID', TOKEN]]),
    defaultToken: TOKEN,
    isLoading: false,
    error: null,
  }),
}));

const VALID_STELLAR_PAYER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const push = vi.fn();

/** Due dates must be in the future and no more than 365 days out. */
function futureDueDate(daysAhead = 30) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

function advanceToReviewAndSubmit() {
  // Step 1 — invoice details
  fireEvent.change(screen.getByPlaceholderText('G...'), {
    target: { value: VALID_STELLAR_PAYER },
  });
  fireEvent.change(screen.getByPlaceholderText('5000.00'), {
    target: { value: '5000' },
  });
  fireEvent.change(screen.getByLabelText(/due date/i), {
    target: { value: futureDueDate() },
  });
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  // Step 2 — token & rate (defaults are valid)
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  // Step 3 — review & submit
  fireEvent.click(screen.getByRole('button', { name: /submit invoice/i }));
}

describe('SubmitInvoiceForm — submission, referral & redirect (#11)', () => {
  beforeEach(() => {
    addToast.mockClear();
    updateToast.mockClear();
    submitInvoiceTransaction.mockReset();
    push.mockReset();
    localStorage.clear();
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>);
  });

  it('renders the optional referral code field', () => {
    render(<SubmitInvoiceForm />);
    expect(screen.getByLabelText(/referral code/i)).toBeInTheDocument();
  });

  it('submits, shows the returned invoice ID, and links to the detail page', async () => {
    submitInvoiceTransaction.mockResolvedValue({ invoiceId: 99n, txHash: 'deadbeef' });
    render(<SubmitInvoiceForm />);

    advanceToReviewAndSubmit();

    expect(await screen.findByText('#99')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /view invoice details/i });
    expect(link).toHaveAttribute('href', '/i/99');
  });

  it('persists a referral code as per-invoice attribution on success', async () => {
    submitInvoiceTransaction.mockResolvedValue({ invoiceId: 7n, txHash: 'abc123' });
    render(<SubmitInvoiceForm />);

    fireEvent.change(screen.getByPlaceholderText('e.g. ILN-FRIEND'), {
      target: { value: 'ILN-FRIEND' },
    });
    advanceToReviewAndSubmit();

    await screen.findByText('#7');
    expect(localStorage.getItem('iln-referral-7')).toBe('ILN-FRIEND');
  });

  it('redirects to the new invoice detail page after a successful submit', async () => {
    submitInvoiceTransaction.mockResolvedValue({ invoiceId: 42n, txHash: 'feed' });
    render(<SubmitInvoiceForm />);

    advanceToReviewAndSubmit();
    await screen.findByText('#42');

    await waitFor(() => expect(push).toHaveBeenCalledWith('/i/42'), { timeout: 2500 });
  });
});
