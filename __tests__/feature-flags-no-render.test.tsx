/**
 * Feature flag DOM and SEO exclusion verification (issues #698 and prior work).
 *
 * These tests confirm that disabled-flag components are:
 *   1. Completely absent from the DOM (not just CSS-hidden).
 *   2. Do not leak any crawlable text content that could be indexed.
 *
 * All three flags (Oracle, NFT, Insurance Pool) are covered comprehensively.
 * See docs/feature-flags.md for the flag lifecycle policy.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Verifies that a component contributes zero DOM nodes when its flag is off.
 * Checks both `container.firstChild === null` (no root element) and the
 * absence of any visible text, so CSS-only hiding would also fail this guard.
 */
function expectNoOutput(container: HTMLElement, querySelectorPattern: string) {
  // No root DOM node at all — not a hidden <div>, not an aria-hidden node.
  expect(container.firstChild).toBeNull();
  // No element matching the component's characteristic selector.
  expect(container.querySelector(querySelectorPattern)).toBeNull();
  // Container text content is empty — confirms no text node leaks.
  expect(container.textContent).toBe('');
}

// ── All-flags-disabled suite (default / production baseline) ──────────────────

describe('Feature Flags Graceful No-Render Verification', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ORACLE_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_NFT_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_INSURANCE_POOL_ENABLED', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Oracle Badge (NEXT_PUBLIC_ORACLE_ENABLED) ──────────────────────────────

  it('renders nothing when NEXT_PUBLIC_ORACLE_ENABLED is false', () => {
    const { container } = render(<OracleBadge verified={true} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Oracle Verified/i)).not.toBeInTheDocument();
  });

  it('Oracle: container has no child nodes at all (not CSS-hidden)', () => {
    const { container } = render(<OracleBadge verified={false} />);
    expectNoOutput(container, '[data-testid], [aria-hidden]');
  });

  it('Oracle: no crawlable text leaks into the DOM when disabled', () => {
    const { container } = render(<OracleBadge verified={true} />);
    expect(container.textContent).toBe('');
  });

  // ── Invoice NFT Card (NEXT_PUBLIC_NFT_ENABLED) ─────────────────────────────

  it('renders nothing when NEXT_PUBLIC_NFT_ENABLED is false', () => {
    const { container } = render(
      <InvoiceNftCard invoiceId={1n} invoiceStatus="Pending" walletAddress={null} />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Invoice NFT/i)).not.toBeInTheDocument();
  });

  it('NFT: container has no child nodes at all (not CSS-hidden)', () => {
    const { container } = render(
      <InvoiceNftCard invoiceId={99n} invoiceStatus="Funded" walletAddress="GSOME" />
    );
    expectNoOutput(container, 'img, canvas, [role="img"]');
  });

  it('NFT: no crawlable text leaks into the DOM when disabled', () => {
    const { container } = render(
      <InvoiceNftCard invoiceId={1n} invoiceStatus="Pending" walletAddress={null} />
    );
    expect(container.textContent).toBe('');
  });

  // ── Insurance Pool Panel (NEXT_PUBLIC_INSURANCE_POOL_ENABLED) ─────────────

  it('renders nothing when NEXT_PUBLIC_INSURANCE_POOL_ENABLED is false', () => {
    const { container } = render(<InsurancePoolPanel />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Default Protection/i)).not.toBeInTheDocument();
  });

  it('Insurance Pool: container has no child nodes at all (not CSS-hidden)', () => {
    const { container } = render(<InsurancePoolPanel />);
    expectNoOutput(container, 'section, article, [role="region"]');
  });

  it('Insurance Pool: no crawlable text leaks into the DOM when disabled', () => {
    const { container } = render(<InsurancePoolPanel />);
    expect(container.textContent).toBe('');
  });

  // ── Cross-flag isolation ───────────────────────────────────────────────────

  it('enabling one flag does not cause another disabled flag to render', () => {
    vi.stubEnv('NEXT_PUBLIC_ORACLE_ENABLED', 'true');
    // NFT and Insurance remain false.

    const { container: nftContainer } = render(
      <InvoiceNftCard invoiceId={1n} invoiceStatus="Pending" walletAddress={null} />
    );
    expect(nftContainer.firstChild).toBeNull();

    const { container: poolContainer } = render(<InsurancePoolPanel />);
    expect(poolContainer.firstChild).toBeNull();
  });
});
