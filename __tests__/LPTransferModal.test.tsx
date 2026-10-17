import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockExecute = vi.fn();
const mockUseBalances = vi.fn();

vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: () => ({ execute: mockExecute, loading: false, error: null }),
}));

vi.mock('@/hooks/useBalances', () => ({
  useBalances: () => mockUseBalances(),
}));

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({ address: 'GSELF' + 'B'.repeat(51), isConnected: true }),
}));

const mockBuild = vi.fn(() => 'built-tx');
const mockSetTimeout = vi.fn(() => ({ build: mockBuild }));
const mockAddOperation = vi.fn(() => ({ setTimeout: mockSetTimeout }));

vi.mock('@stellar/stellar-sdk', () => ({
  // Called with `new`, so the implementation must be constructible.
  TransactionBuilder: vi.fn(function (this: Record<string, unknown>) {
    this.addOperation = mockAddOperation;
  }),
  Operation: { invokeContractFunction: vi.fn(() => 'invoke-op') },
  Address: { fromString: vi.fn(() => ({ toScVal: vi.fn() })) },
  nativeToScVal: vi.fn(() => 'invoice-id-scval'),
  BASE_FEE: '100',
  rpc: {
    // Called with `new`, so the implementation must be constructible.
    Server: vi.fn(function (this: Record<string, unknown>) {
      this.getAccount = vi.fn().mockResolvedValue({});
      this.simulateTransaction = vi.fn().mockResolvedValue({ result: {} });
    }),
    Api: { isSimulationSuccess: vi.fn(() => true) },
    assembleTransaction: vi.fn(() => ({ build: vi.fn(() => 'assembled-tx') })),
  },
}));

vi.mock('@/constants', () => ({
  CONTRACT_ID: 'CTEST',
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  RPC_URL: 'https://soroban-testnet.stellar.org',
  TESTNET_USDC_TOKEN_ID: 'token-usdc',
  TESTNET_EURC_TOKEN_ID: 'token-eurc',
  TESTNET_XLM_TOKEN_ID: 'token-xlm',
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import LPTransferModal from '@/components/LPTransferModal';
import type { Invoice } from '@/utils/soroban';

const VALID_RECIPIENT = 'GRECIPIENT' + 'A'.repeat(46);
const SELF_ADDRESS = 'GSELF' + 'B'.repeat(51);

const invoice: Invoice = {
  id: 42n,
  freelancer: 'GFR1',
  payer: 'GPAYER1',
  amount: 5_0000000n, // 5 USDC — above the 1 USDC transfer minimum
  due_date: 1_900_000_000n,
  discount_rate: 300,
  status: 'Funded',
  funder: SELF_ADDRESS,
};

function renderModal(onSuccess = vi.fn(), onClose = vi.fn()) {
  return render(<LPTransferModal invoice={invoice} onClose={onClose} onSuccess={onSuccess} />);
}

function fillConfirmation(suffix = 'AAAAAA') {
  const confirmInput = screen.getByPlaceholderText(/e\.g\./i);
  fireEvent.change(confirmInput, { target: { value: suffix } });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LPTransferModal', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockUseBalances.mockReturnValue({
      balances: new Map([
        ['token-usdc', 10_000_000_000n],
        ['token-eurc', 8_000_000_000n],
        ['token-xlm', 25_000_000_000n],
      ]),
      unavailable: new Set(),
      isLoading: false,
    });
  });

  it('renders the modal with invoice id and ownership warning', () => {
    renderModal();
    expect(screen.getByText(/Transfer LP Position #42/i)).toBeInTheDocument();
    expect(screen.getByText(/permanently reassigns payout ownership/i)).toBeInTheDocument();
  });

  it('lets the user select USDC, EURC, and XLM and shows token balances', () => {
    renderModal();

    expect(screen.getAllByRole('button', { name: /USDC/i })[0]).toBeInTheDocument();
    expect(screen.getAllByText('Balance: 1,000 USDC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1,000 USDC').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /USDC/i })[0]);
    fireEvent.click(screen.getAllByRole('option', { name: /EURC/i })[0]);
    expect(screen.getAllByRole('button', { name: /EURC/i })[0]).toBeInTheDocument();
    expect(screen.getAllByText('800 EURC').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /EURC/i })[0]);
    fireEvent.click(screen.getAllByRole('option', { name: /XLM/i })[0]);
    expect(screen.getAllByRole('button', { name: /XLM/i })[0]).toBeInTheDocument();
    expect(screen.getAllByText('2,500 XLM').length).toBeGreaterThan(0);
  });

  it('shows a validation error when the address field is empty', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Transfer Position/i }));
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('shows a validation error for an invalid G-address', async () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('G...'), { target: { value: 'NOTVALID' } });
    fireEvent.click(screen.getByRole('button', { name: /Transfer Position/i }));
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('prevents self-transfer', async () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('G...'), { target: { value: SELF_ADDRESS } });
    fillConfirmation(SELF_ADDRESS.slice(-6));
    fireEvent.click(screen.getByRole('button', { name: /Transfer Position/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot transfer.*yourself/i);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('validates the selected token minimum', async () => {
    // 0.5 XLM is below the 10 XLM minimum; the modal starts on the invoice token.
    const smallXlmInvoice = { ...invoice, amount: 5_000_000n, token: 'token-xlm' };
    render(<LPTransferModal invoice={smallXlmInvoice} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('G...'), { target: { value: VALID_RECIPIENT } });
    fillConfirmation('AAAAAA');
    fireEvent.click(screen.getByRole('button', { name: /Transfer Position/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /XLM transfers require at least 10 XLM/i
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('prevents submitting when the selected token does not match the invoice token', async () => {
    renderModal();

    fireEvent.click(screen.getAllByRole('button', { name: /USDC/i })[0]);
    fireEvent.click(screen.getAllByRole('option', { name: /EURC/i })[0]);
    fireEvent.change(screen.getByPlaceholderText('G...'), { target: { value: VALID_RECIPIENT } });
    fillConfirmation('AAAAAA');
    fireEvent.click(screen.getByRole('button', { name: /Transfer Position/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Select the invoice token/i);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('validates the selected token balance', async () => {
    mockUseBalances.mockReturnValue({
      balances: new Map([['token-usdc', 1_000_000n]]),
      unavailable: new Set(),
      isLoading: false,
    });
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('G...'), { target: { value: VALID_RECIPIENT } });
    fillConfirmation('AAAAAA');
    fireEvent.click(screen.getByRole('button', { name: /Transfer Position/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Insufficient USDC balance/i);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('disables submit button until destination confirmation suffix is typed', async () => {
    renderModal();
    const submitBtn = screen.getByRole('button', { name: /Transfer Position/i });
    expect(submitBtn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('G...'), { target: { value: VALID_RECIPIENT } });
    expect(submitBtn).toBeDisabled();

    // Type wrong suffix
    fillConfirmation('WRONGG');
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText('Mismatch')).toBeInTheDocument();

    // Type correct suffix
    fillConfirmation('AAAAAA');
    expect(submitBtn).not.toBeDisabled();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('calls execute and invokes onSuccess with a valid address', async () => {
    mockExecute.mockResolvedValue('tx-hash-abc');
    const onSuccess = vi.fn();
    renderModal(onSuccess);

    fireEvent.change(screen.getByPlaceholderText('G...'), { target: { value: VALID_RECIPIENT } });
    fillConfirmation('AAAAAA');
    fireEvent.click(screen.getByRole('button', { name: /Transfer Position/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenCalledWith(invoice, VALID_RECIPIENT);
    expect(mockExecute).toHaveBeenCalledWith('assembled-tx', 'Transfer 5 USDC LP position #42');
  });

  it('does not call onSuccess when execute returns null (user rejected)', async () => {
    mockExecute.mockResolvedValue(null);
    const onSuccess = vi.fn();
    renderModal(onSuccess);

    fireEvent.change(screen.getByPlaceholderText('G...'), { target: { value: VALID_RECIPIENT } });
    fillConfirmation('AAAAAA');
    fireEvent.click(screen.getByRole('button', { name: /Transfer Position/i }));

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    renderModal(vi.fn(), onClose);
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
