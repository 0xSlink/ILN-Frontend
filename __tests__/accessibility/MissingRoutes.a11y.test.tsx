/**
 * Accessibility tests for routes not covered by dedicated a11y test files:
 * /tokens, /roadmap, /leaderboard, /referrals, /payer, /freelancer,
 * /admin, /dashboard, /lp, /pay, /submit, /stats, /offline
 *
 * Each test mocks external dependencies and runs jest-axe against the page.
 */
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';

// ── Shared mocks ──────────────────────────────────────────────────────────────

vi.mock('@/context/ToastContext', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
  useToast: () => ({ addToast: vi.fn(), updateToast: vi.fn(), removeToast: vi.fn() }),
}));

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: null,
    isConnected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('@/components/Navbar', () => ({
  default: () => <nav data-testid="navbar">Navigation</nav>,
}));

vi.mock('@/components/Footer', () => ({
  default: () => <footer data-testid="footer">Footer</footer>,
}));

vi.mock('@/components/ParameterUpdateBanner', () => ({
  default: () => <div data-testid="parameter-update-banner" />,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function expectNoA11yViolations(Component: React.ComponentType) {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Accessibility — Uncovered routes', () => {
  it('/offline has no violations', async () => {
    const Offline = (await import('@/app/offline/page')).default;
    await expectNoA11yViolations(Offline);
  });

  it('/tokens has no violations', async () => {
    // Tokens page re-exports from src/app/tokens/page
    vi.mock('@/hooks/useApprovedTokens', () => ({
      useApprovedTokens: () => ({ tokens: [], isLoading: false }),
    }));
    vi.mock('@/utils/soroban', () => ({
      getTokens: vi.fn().mockResolvedValue([]),
    }));
    const Tokens = (await import('@/app/tokens/page')).default;
    await expectNoA11yViolations(Tokens);
  });

  it('/roadmap has no violations', async () => {
    const Roadmap = (await import('@/app/roadmap/page')).default;
    await expectNoA11yViolations(Roadmap);
  });

  it('/leaderboard has no violations', async () => {
    vi.mock('@/utils/soroban', () => ({
      getTopPayers: vi.fn().mockResolvedValue([]),
      getTopFreelancers: vi.fn().mockResolvedValue([]),
      getTopLPs: vi.fn().mockResolvedValue([]),
    }));
    vi.mock('@/utils/federation', () => ({
      resolveFederatedAddress: vi.fn().mockResolvedValue(null),
    }));
    const Leaderboard = (await import('@/app/leaderboard/page')).default;
    await expectNoA11yViolations(Leaderboard);
  });

  it('/referrals has no violations', async () => {
    vi.mock('@/screens/ReferralsDashboard', () => ({
      default: () => <div data-testid="referrals-dashboard">Referrals</div>,
    }));
    const Referrals = (await import('@/app/referrals/page')).default;
    await expectNoA11yViolations(Referrals);
  });

  it('/stats has no violations', async () => {
    vi.mock('@/utils/soroban', () => ({
      getProtocolStats: vi.fn().mockResolvedValue({}),
    }));
    const Stats = (await import('@/app/stats/page')).default;
    await expectNoA11yViolations(Stats);
  });

  it('/freelancer has no violations', async () => {
    vi.mock('@/utils/soroban', () => ({
      getAllInvoices: vi.fn().mockResolvedValue([]),
    }));
    const Freelancer = (await import('@/app/freelancer/page')).default;
    await expectNoA11yViolations(Freelancer);
  });

  it('/lp has no violations', async () => {
    vi.mock('@/utils/soroban', () => ({
      getAllInvoices: vi.fn().mockResolvedValue([]),
    }));
    const LP = (await import('@/app/lp/page')).default;
    await expectNoA11yViolations(LP);
  });

  it('/pay has no violations', async () => {
    vi.mock('@/utils/soroban', () => ({
      getAllInvoices: vi.fn().mockResolvedValue([]),
    }));
    const Pay = (await import('@/app/pay/page')).default;
    await expectNoA11yViolations(Pay);
  });

  it('/submit has no violations', async () => {
    vi.mock('@/utils/soroban', () => ({
      submitInvoice: vi.fn().mockResolvedValue({}),
    }));
    const Submit = (await import('@/app/submit/page')).default;
    await expectNoA11yViolations(Submit);
  });

  it('/admin has no violations', async () => {
    vi.mock('@/utils/soroban', () => ({
      getProtocolStats: vi.fn().mockResolvedValue({}),
    }));
    const Admin = (await import('@/app/admin/page')).default;
    await expectNoA11yViolations(Admin);
  });
});
