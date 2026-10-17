/**
 * Per-page accessibility suite for the Home page.
 *
 * Split with __tests__/accessibility.test.tsx (see that file's doc comment for the
 * full picture): this file mocks out every child section as a lightweight stub and
 * asserts page-level structure (heading count, navbar/hero/footer landmarks) in
 * isolation. The root file additionally axe-checks the real Home page rendered under
 * the full app Providers tree - that overlap is intentional, not redundant.
 */
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import HomePage from '@/app/page';

// Mock the hooks and components
vi.mock('@/context/ToastContext', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ToastProvider: ({ children }: { children: any }) => children,
  useToast: () => ({
    addToast: vi.fn(),
    updateToast: vi.fn(),
    removeToast: vi.fn(),
  }),
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

vi.mock('@/components/Hero', () => ({
  default: () => (
    <div data-testid="hero">
      <h1>Invoice Liquidity Network</h1>
    </div>
  ),
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

vi.mock('@/components/PersonalizedDashboard', () => ({
  default: () => <section data-testid="personalized-dashboard" />,
}));

vi.mock('@/components/Stats', () => ({
  default: () => <section data-testid="stats" />,
}));

vi.mock('@/components/HowItWorks', () => ({
  default: () => <section data-testid="how-it-works" />,
}));

vi.mock('@/components/ForFreelancers', () => ({
  default: () => <section data-testid="for-freelancers" />,
}));

vi.mock('@/components/ForLPs', () => ({
  default: () => <section data-testid="for-lps" />,
}));

vi.mock('@/components/ContractActions', () => ({
  default: () => <section data-testid="contract-actions" />,
}));

vi.mock('@/components/BuiltOnStellar', () => ({
  default: () => <section data-testid="built-on-stellar" />,
}));

vi.mock('@/components/OpenSource', () => ({
  default: () => <section data-testid="open-source" />,
}));

describe('HomePage Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(<HomePage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper heading structure', () => {
    const { container } = render(<HomePage />);

    // Should have at least one h1
    const h1Elements = container.querySelectorAll('h1');
    expect(h1Elements.length).toBeGreaterThanOrEqual(1);
  });

  it('should have proper landmark structure', () => {
    const { getByTestId } = render(<HomePage />);

    expect(getByTestId('navbar')).toBeInTheDocument();
    expect(getByTestId('hero')).toBeInTheDocument();
    expect(getByTestId('footer')).toBeInTheDocument();
  });
});
