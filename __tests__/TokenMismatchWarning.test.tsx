import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FundConfirmModal from '../src/components/FundConfirmModal';
import { Invoice } from '../src/utils/soroban';

// Mock hooks and context
vi.mock('../src/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GDTEST...',
    signTx: vi.fn(),
  }),
}));

vi.mock('../src/context/ToastContext', () => ({
  useToast: () => ({
    addToast: vi.fn(),
    updateToast: vi.fn(),
  }),
}));

vi.mock('../src/hooks/useTransaction', () => ({
  useTransaction: () => ({
    execute: vi.fn(),
    loading: false,
    error: null,
    signingModal: null,
  }),
}));

vi.mock('../src/hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({
    tokens: [
      { contractId: 'USDC_ID', symbol: 'USDC', decimals: 7 },
      { contractId: 'XLM_ID', symbol: 'XLM', decimals: 7 },
    ],
    tokenMap: new Map([
      ['USDC_ID', { contractId: 'USDC_ID', symbol: 'USDC', decimals: 7 }],
      ['XLM_ID', { contractId: 'XLM_ID', symbol: 'XLM', decimals: 7 }],
    ]),
    defaultToken: { contractId: 'USDC_ID', symbol: 'USDC', decimals: 7 },
  }),
}));

vi.mock('../src/utils/soroban', () => ({
  getTokenAllowance: vi.fn(() => Promise.resolve(1000n * 10n ** 7n)),
  buildApproveTokenTransaction: vi.fn(),
  fundInvoice: vi.fn(),
  submitSignedTransaction: vi.fn(),
}));

vi.mock('../src/utils/format', () => ({
  formatTokenAmount: (val: bigint) => (Number(val) / 10 ** 7).toString(),
  formatDate: (_val: bigint) => '2026-01-01',
  calculateYield: (val: bigint, rate: number) => (val * BigInt(rate)) / 10000n,
  formatAddress: (val: string) => val.slice(0, 4),
}));

describe('FundConfirmModal - Token Mismatch Warning', () => {
  const mockInvoice: Invoice = {
    id: 123n,
    status: 'Pending',
    freelancer: 'FREELANCER',
    payer: 'PAYER',
    amount: 1000n * 10n ** 7n,
    due_date: 9999999999n,
    discount_rate: 500,
    token: 'USDC_ID',
  };

  it("automatically sets the token selector to the invoice's required token", async () => {
    render(<FundConfirmModal invoice={mockInvoice} onClose={vi.fn()} onSuccess={vi.fn()} />);

    // Should show USDC as selected since invoice.token is USDC_ID
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /USDC/i })).toBeInTheDocument();
    });
  });

  it('shows an amber warning when the selected token does not match the invoice', async () => {
    render(<FundConfirmModal invoice={mockInvoice} onClose={vi.fn()} onSuccess={vi.fn()} />);

    // Wait for initial render and allowance check
    await waitFor(() =>
      expect(screen.queryByText('Checking current allowance...')).not.toBeInTheDocument()
    );

    // Click the token selector button to open it
    const selectorBtn = screen.getByRole('button', { name: /USDC/i });
    fireEvent.click(selectorBtn);

    // Select XLM from the options
    // The option list renders twice (desktop dropdown + mobile sheet).
    const xlmOption = screen.getAllByRole('option', { name: /XLM/i })[0];
    fireEvent.click(xlmOption);

    // Should show the warning
    expect(screen.getByText(/This invoice is denominated in/)).toBeInTheDocument();
  });

  it('disables the Fund Now button when token mismatch persists', async () => {
    render(<FundConfirmModal invoice={mockInvoice} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() =>
      expect(screen.queryByText('Checking current allowance...')).not.toBeInTheDocument()
    );

    const selectorBtn = screen.getByRole('button', { name: /USDC/i });
    fireEvent.click(selectorBtn);

    // The option list renders twice (desktop dropdown + mobile sheet).
    const xlmOption = screen.getAllByRole('option', { name: /XLM/i })[0];
    fireEvent.click(xlmOption);

    const fundBtn = screen.getByText('Currency Mismatch');
    expect(fundBtn).toBeDisabled();
  });
});
