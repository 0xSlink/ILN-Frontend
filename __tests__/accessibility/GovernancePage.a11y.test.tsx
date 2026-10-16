/**
 * Per-page accessibility suite for the Governance page.
 *
 * Split with __tests__/accessibility.test.tsx (see that file's doc comment for the
 * full picture): this file adds granular structural checks - heading hierarchy,
 * filter control labeling, link accessibility, status indicator semantics - that the
 * root file doesn't assert. The root file additionally axe-checks this page under the
 * full app Providers tree and covers cross-page keyboard tab order; that overlap on
 * the basic "no axe violations" check is an intentional regression safety net, not
 * redundant duplication.
 */
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import GovernancePage from '@/app/governance/page';

// Mock the dependencies
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GTEST123',
    isConnected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('@/utils/governance', () => ({
  GOVERNANCE_INTEGRATION_STATUS: {
    getVotingPower: { status: 'Stubbed', label: 'Voting power lookup' },
  },
  fetchProposals: vi.fn(() => Promise.resolve([])),
  getVotingPower: vi.fn(() => Promise.resolve(100)),
  timeRemaining: vi.fn(() => '2 days'),
  totalVotes: vi.fn(() => 1000),
}));

vi.mock('@/components/Footer', () => ({
  default: () => <footer data-testid="footer">Footer</footer>,
}));

vi.mock('@/components/Navbar', () => ({
  default: () => <nav data-testid="navbar">Navigation</nav>,
}));

vi.mock('@/components/VoteProgressBar', () => ({
  default: ({ proposal: _proposal }: any) => <div data-testid="vote-progress">Vote Progress</div>,
}));

vi.mock('@/components/governance/TokenAllowlistPanel', () => ({
  default: () => <div data-testid="token-allowlist">Token Allowlist Panel</div>,
}));

vi.mock('@/components/VotingPowerDisplay', () => ({
  default: ({ power }: any) => <div data-testid="voting-power">Voting Power: {power}</div>,
}));

describe('GovernancePage Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(<GovernancePage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper heading hierarchy', () => {
    const { container } = render(<GovernancePage />);

    const h1 = container.querySelector('h1');
    expect(h1).toBeInTheDocument();

    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('should have accessible filter controls', () => {
    const { container } = render(<GovernancePage />);

    // Check for filter buttons
    const filterButtons = container.querySelectorAll('[role="button"], button');
    filterButtons.forEach((button) => {
      const hasAccessibleName =
        button.textContent?.trim() ||
        button.getAttribute('aria-label') ||
        button.getAttribute('aria-labelledby');

      expect(hasAccessibleName).toBeTruthy();
    });
  });

  it('should have proper link accessibility', () => {
    const { container } = render(<GovernancePage />);

    const links = container.querySelectorAll('a');
    links.forEach((link) => {
      // Links should have accessible names
      const hasAccessibleName =
        link.textContent?.trim() ||
        link.getAttribute('aria-label') ||
        link.getAttribute('aria-labelledby');

      expect(hasAccessibleName).toBeTruthy();
    });
  });

  it('should have proper status indicators', () => {
    const { container } = render(<GovernancePage />);

    // Status badges should be accessible
    const statusElements = container.querySelectorAll('[class*="badge"], [class*="status"]');
    statusElements.forEach((element) => {
      // Should have text content or aria-label
      const hasAccessibleText = element.textContent?.trim() || element.getAttribute('aria-label');

      expect(hasAccessibleText).toBeTruthy();
    });
  });
});
