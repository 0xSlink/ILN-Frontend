import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We re-import the module after manipulating the env so we need to use dynamic import
// and vi.resetModules between tests that toggle the flag.

describe('OracleBadge', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  describe('when NEXT_PUBLIC_ORACLE_ENABLED=true', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_ORACLE_ENABLED', 'true');
    });

    it('renders a green verified badge for oracle-verified payers', async () => {
      const { default: OracleBadge } = await import('@/components/OracleBadge');
      render(<OracleBadge verified={true} />);
      const badge = screen.getByTitle('This address has been verified by the ILN off-chain oracle');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toMatch(/Oracle Verified/i);
      expect(badge.className).toMatch(/green/);
    });

    it('renders a grey unverified indicator for non-verified payers', async () => {
      const { default: OracleBadge } = await import('@/components/OracleBadge');
      render(<OracleBadge verified={false} />);
      const badge = screen.getByTitle(
        'This address has not been verified by the ILN off-chain oracle'
      );
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toMatch(/Unverified/i);
      expect(badge.className).not.toMatch(/green/);
    });

    it('renders the circuit-tripped state over a stale verification', async () => {
      const { default: OracleBadge } = await import('@/components/OracleBadge');
      render(<OracleBadge verified={true} registryState="circuit_tripped" />);
      const badge = screen.getByTitle(
        'The oracle circuit breaker is open after repeated stale data, so payer verification is temporarily unavailable.'
      );
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toMatch(/Verification Unavailable/i);
      expect(badge.className).toMatch(/amber/);
    });

    it('renders the stale-data state when the oracle feed is outdated', async () => {
      const { default: OracleBadge } = await import('@/components/OracleBadge');
      render(<OracleBadge verified={false} registryState="data_stale" />);
      const badge = screen.getByTitle(
        'The latest oracle response is older than the configured freshness window.'
      );
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toMatch(/Oracle Data Stale/i);
    });

    it('renders the unconfigured state when no oracle feed is registered', async () => {
      const { default: OracleBadge } = await import('@/components/OracleBadge');
      render(<OracleBadge verified={false} registryState="unconfigured" />);
      const badge = screen.getByTitle(
        'No oracle feed is configured for payer verification; funding will fail open.'
      );
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toMatch(/Oracle Not Configured/i);
    });

    it('falls back to verification states when registry state is healthy', async () => {
      const { default: OracleBadge } = await import('@/components/OracleBadge');
      render(<OracleBadge verified={true} registryState="healthy" />);
      expect(
        screen.getByTitle('This address has been verified by the ILN off-chain oracle')
      ).toBeInTheDocument();
    });
  });

  describe('when NEXT_PUBLIC_ORACLE_ENABLED is not set', () => {
    it('renders nothing', async () => {
      vi.stubEnv('NEXT_PUBLIC_ORACLE_ENABLED', 'false');
      const { default: OracleBadge } = await import('@/components/OracleBadge');
      const { container } = render(<OracleBadge verified={true} registryState="circuit_tripped" />);
      expect(container.firstChild).toBeNull();
    });
  });
});
