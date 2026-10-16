import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SubmitInvoiceForm from '../src/components/SubmitInvoiceForm';
import { useSearchParams } from 'next/navigation';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: vi.fn(),
}));

// Mock useWallet
vi.mock('../src/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    isConnected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    networkMismatch: false,
  }),
}));

// SubmitInvoiceForm reads the toast context (directly and via useTransaction).
vi.mock('../src/context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn(() => 'toast-id'), updateToast: vi.fn() }),
}));

// Mock useTransaction
vi.mock('../src/hooks/useTransaction', () => ({
  useTransaction: () => ({
    execute: vi.fn(),
    loading: false,
    error: null,
    signingModal: null,
  }),
}));

// Mock useApprovedTokens
vi.mock('../src/hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({
    tokens: [],
    tokenMap: new Map(),
    defaultToken: { symbol: 'USDC', decimals: 7, contractId: 'USDC_ID' },
    isLoading: false,
    error: null,
  }),
}));

describe('SubmitInvoiceForm Referral Pre-fill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-fills the referral code field when ref query param is present', async () => {
    (useSearchParams as any).mockReturnValue(new URLSearchParams('?ref=TESTCODE'));

    render(<SubmitInvoiceForm />);

    const referralInput = screen.getByPlaceholderText(/e.g. ILN-FRIEND/i) as HTMLInputElement;
    expect(referralInput.value).toBe('TESTCODE');
  });

  it('leaves referral code field empty when no ref param is present', () => {
    (useSearchParams as any).mockReturnValue(new URLSearchParams(''));

    render(<SubmitInvoiceForm />);

    const referralInput = screen.getByPlaceholderText(/e.g. ILN-FRIEND/i) as HTMLInputElement;
    expect(referralInput.value).toBe('');
  });
});
