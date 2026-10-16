/**
 * Cross-feature-flag interaction test matrix (issue #702).
 *
 * Tests all 2^3 combinations of the three boolean feature flags
 * (ORACLE, NFT, INSURANCE_POOL) against individual gated components.
 * Ensures no combination causes rendering errors, missing elements,
 * or cross-flag interference.
 *
 * See docs/feature-flags.md for the flag lifecycle policy.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OracleBadge from '../src/components/OracleBadge';
import InvoiceNftCard from '../src/components/InvoiceNftCard';
import InsurancePoolPanel from '../src/components/InsurancePoolPanel';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../src/hooks/useInvoiceNft', () => ({
  useInvoiceNft: vi.fn(() => ({
    state: { status: 'minted', tokenId: 42n, metadata: { name: 'Test NFT', image: null } },
    loading: false,
    reload: vi.fn(),
  })),
}));

vi.mock('../src/hooks/useInsurance', () => ({
  useInsurance: vi.fn(() => ({
    poolInfo: { balance: 1000n, enrolled_count: 5, premium_rate: 500 },
    isEnrolled: false,
    isLoading: false,
    refresh: vi.fn(),
  })),
}));

vi.mock('../src/hooks/useTransaction', () => ({
  useTransaction: vi.fn(() => ({ execute: vi.fn() })),
}));

vi.mock('../src/hooks/useApprovedTokens', () => ({
  useApprovedTokens: vi.fn(() => ({
    defaultToken: { symbol: 'USDC', decimals: 7, contractId: 'CABC' },
  })),
}));

vi.mock('../src/context/WalletContext', () => ({
  useWallet: () => ({ address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6' }),
}));

// ── Flag combination matrix ────────────────────────────────────────────────

type FlagCombo = {
  oracle: boolean;
  nft: boolean;
  insurance: boolean;
  label: string;
};

const ALL_COMBOS: FlagCombo[] = [
  { oracle: false, nft: false, insurance: false, label: 'all off' },
  { oracle: true, nft: false, insurance: false, label: 'oracle only' },
  { oracle: false, nft: true, insurance: false, label: 'nft only' },
  { oracle: false, nft: false, insurance: true, label: 'insurance only' },
  { oracle: true, nft: true, insurance: false, label: 'oracle + nft' },
  { oracle: true, nft: false, insurance: true, label: 'oracle + insurance' },
  { oracle: false, nft: true, insurance: true, label: 'nft + insurance' },
  { oracle: true, nft: true, insurance: true, label: 'all on' },
];

// ── Individual component tests per combination ─────────────────────────────

describe('Cross-feature-flag interaction matrix', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe.each(ALL_COMBOS)('$label (oracle=$oracle, nft=$nft, insurance=$insurance)', (combo) => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_ORACLE_ENABLED', String(combo.oracle));
      vi.stubEnv('NEXT_PUBLIC_NFT_ENABLED', String(combo.nft));
      vi.stubEnv('NEXT_PUBLIC_INSURANCE_POOL_ENABLED', String(combo.insurance));
    });

    it('OracleBadge renders when oracle=true, null when oracle=false', () => {
      const { container } = render(<OracleBadge verified={true} />);
      if (combo.oracle) {
        expect(screen.getByText('Oracle Verified')).toBeInTheDocument();
      } else {
        expect(container.firstChild).toBeNull();
      }
    });

    it('InvoiceNftCard renders when nft=true, null when nft=false', () => {
      const { container } = render(
        <InvoiceNftCard invoiceId={1n} invoiceStatus="Pending" walletAddress={null} />
      );
      if (combo.nft) {
        expect(screen.getByText(/Invoice NFT/)).toBeInTheDocument();
      } else {
        expect(container.firstChild).toBeNull();
      }
    });

    it('InsurancePoolPanel renders when insurance=true, null when insurance=false', () => {
      const { container } = render(<InsurancePoolPanel />);
      if (combo.insurance) {
        expect(screen.getByText('Default Protection')).toBeInTheDocument();
      } else {
        expect(container.firstChild).toBeNull();
      }
    });

    it('enabling one flag does not cause another disabled flag to render', () => {
      render(<OracleBadge verified={true} />);
      render(
        <InvoiceNftCard invoiceId={1n} invoiceStatus="Pending" walletAddress={null} />
      );
      render(<InsurancePoolPanel />);

      if (!combo.oracle) {
        expect(screen.queryByText('Oracle Verified')).not.toBeInTheDocument();
      }
      if (!combo.nft) {
        expect(screen.queryByText(/Invoice NFT/)).not.toBeInTheDocument();
      }
      if (!combo.insurance) {
        expect(screen.queryByText('Default Protection')).not.toBeInTheDocument();
      }
    });
  });
});

// ── Edge case: multiple flags on, verify no layout collision ───────────────

describe('Multi-flag rendering isolation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('oracle + nft: both render independently without overlap', () => {
    vi.stubEnv('NEXT_PUBLIC_ORACLE_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_NFT_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_INSURANCE_POOL_ENABLED', 'false');

    const { container } = render(
      <>
        <OracleBadge verified={true} />
        <InvoiceNftCard invoiceId={42n} invoiceStatus="Funded" walletAddress="GAAA" />
      </>
    );

    expect(screen.getByText('Oracle Verified')).toBeInTheDocument();
    expect(screen.getByText(/Invoice NFT/)).toBeInTheDocument();
    expect(container.children.length).toBe(2);
  });

  it('all three flags on: all render without crashing', () => {
    vi.stubEnv('NEXT_PUBLIC_ORACLE_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_NFT_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_INSURANCE_POOL_ENABLED', 'true');

    const { container } = render(
      <>
        <OracleBadge verified={false} />
        <InvoiceNftCard invoiceId={7n} invoiceStatus="Pending" walletAddress={null} />
        <InsurancePoolPanel />
      </>
    );

    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(screen.getByText(/Invoice NFT/)).toBeInTheDocument();
    expect(screen.getByText('Default Protection')).toBeInTheDocument();
    expect(container.children.length).toBe(3);
  });
});
