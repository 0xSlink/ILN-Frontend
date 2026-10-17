import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'jest-axe';
import React from 'react';
import SubmitInvoiceForm from '@/components/SubmitInvoiceForm';
import NewGovernanceProposalPage from '../../app/governance/new/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    isConnected: true,
    signTx: vi.fn(),
  }),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({
    tokens: [
      {
        contractId: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 7,
        iconLabel: 'US',
        logo: '/tokens/usdc.svg',
        isAllowed: true,
      },
    ],
    tokenMap: new Map(),
    defaultToken: {
      contractId: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 7,
      iconLabel: 'US',
      logo: '/tokens/usdc.svg',
      isAllowed: true,
    },
    isLoading: false,
    error: null,
    validateTokenAddress: vi.fn(() => true),
    approveToken: vi.fn(),
    removeToken: vi.fn(),
  }),
}));

vi.mock('@/hooks/useBalances', () => ({
  useBalances: () => ({
    balances: [],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: () => ({
    execute: vi.fn(),
    loading: false,
    error: null,
    success: false,
    isSigning: false,
    signingModal: null,
  }),
}));

describe('Form ARIA Error Associations', () => {
  describe('SubmitInvoiceForm ARIA error associations', () => {
    it('associates error messages with inputs using aria-describedby and aria-invalid on validation failure', async () => {
      const { container } = render(<SubmitInvoiceForm />);

      const payerInput = screen.getByPlaceholderText('G...');

      // Change and blur invalid value to trigger touched error state
      fireEvent.change(payerInput, { target: { value: 'invalid-stellar-address' } });
      fireEvent.blur(payerInput);

      await waitFor(() => {
        expect(payerInput).toHaveAttribute('aria-invalid', 'true');
        expect(payerInput).toHaveAttribute('aria-describedby', 'payer-error');
      });

      const payerError = container.querySelector('#payer-error');
      expect(payerError).not.toBeNull();

      // Assert no accessibility violations with axe
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('NewGovernanceProposalPage ARIA error associations', () => {
    it('associates title and description error messages using aria-describedby and aria-invalid', async () => {
      const { container } = render(<NewGovernanceProposalPage />);

      // Wait for protocol parameters to load
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Reduce Base Discount Rate/)).toBeDefined();
      });

      const titleInput = screen.getByPlaceholderText(/Reduce Base Discount Rate/);
      const descriptionTextarea = screen.getByPlaceholderText(/Provide a detailed explanation/);

      // Trigger blur/validation
      fireEvent.change(titleInput, { target: { value: '' } });
      fireEvent.blur(titleInput);
      fireEvent.change(descriptionTextarea, { target: { value: '' } });
      fireEvent.blur(descriptionTextarea);

      await waitFor(() => {
        expect(titleInput).toHaveAttribute('aria-invalid', 'true');
        expect(titleInput).toHaveAttribute('aria-describedby', 'title-error');
        expect(descriptionTextarea).toHaveAttribute('aria-invalid', 'true');
        expect(descriptionTextarea).toHaveAttribute('aria-describedby', 'description-error');
      });

      const titleError = screen.getByText('Title is required.');
      expect(titleError).toHaveAttribute('id', 'title-error');

      const descError = screen.getByText('Description is required.');
      expect(descError).toHaveAttribute('id', 'description-error');

      // Assert no accessibility violations with axe
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
