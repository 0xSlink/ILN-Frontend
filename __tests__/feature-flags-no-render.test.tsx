import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OracleBadge from '../src/components/OracleBadge';
import InvoiceNftCard from '../src/components/InvoiceNftCard';
import InsurancePoolPanel from '../src/components/InsurancePoolPanel';

vi.mock('../src/hooks/useInvoiceNft', () => ({
  useInvoiceNft: vi.fn(() => ({ state: null, loading: false, reload: vi.fn() })),
}));

vi.mock('../src/hooks/useInsurance', () => ({
  useInsurance: vi.fn(() => ({
    poolInfo: null,
    isEnrolled: false,
    isLoading: false,
    refresh: vi.fn(),
  })),
}));

vi.mock('../src/hooks/useTransaction', () => ({
  useTransaction: vi.fn(() => ({ execute: vi.fn() })),
}));

vi.mock('../src/hooks/useApprovedTokens', () => ({
  useApprovedTokens: vi.fn(() => ({ defaultToken: { symbol: 'USDC', decimals: 7 } })),
}));

vi.mock('../src/context/WalletContext', () => ({
  useWallet: () => ({ address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6' }),
}));

describe('Feature Flags Graceful No-Render Verification', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ORACLE_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_NFT_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_INSURANCE_POOL_ENABLED', 'false');
  });

  it('renders nothing when NEXT_PUBLIC_ORACLE_ENABLED is false', () => {
    const { container } = render(<OracleBadge verified={true} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Oracle Verified/i)).not.toBeInTheDocument();
  });

  it('renders nothing when NEXT_PUBLIC_NFT_ENABLED is false', () => {
    const { container } = render(
      <InvoiceNftCard invoiceId={1n} invoiceStatus="Pending" walletAddress={null} />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Invoice NFT/i)).not.toBeInTheDocument();
  });

  it('renders nothing when NEXT_PUBLIC_INSURANCE_POOL_ENABLED is false', () => {
    const { container } = render(<InsurancePoolPanel />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Default Protection/i)).not.toBeInTheDocument();
  });
});
