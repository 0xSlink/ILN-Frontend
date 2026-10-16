/**
 * Per-page accessibility suite for the Marketplace page.
 *
 * Split with __tests__/accessibility.test.tsx (see that file's doc comment for the
 * full picture): the Marketplace page has no coverage there, so this file is the only
 * a11y suite for it - not a duplicate of anything else.
 */
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { NotificationProvider } from '@/context/NotificationContext';
import MarketplacePage from '@/app/marketplace/page';

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: null,
    isConnected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}));

vi.mock('@/hooks/useApprovedTokens', () => ({
  useApprovedTokens: vi.fn(() => ({
    tokenMap: new Map(),
    defaultToken: null,
  })),
}));

vi.mock('@/hooks/usePayerScores', () => ({
  usePayerScores: vi.fn(() => ({
    scores: new Map(),
    risks: new Map(),
  })),
}));

vi.mock('@/hooks/useLPSettings', () => ({
  useLPSettings: vi.fn(() => ({
    settings: { minReputation: 0 },
  })),
}));

vi.mock('@/components/Navbar', () => ({
  default: () => <nav data-testid="navbar">Navigation</nav>,
}));

vi.mock('@/components/Footer', () => ({
  default: () => <footer data-testid="footer">Footer</footer>,
}));

vi.mock('@/components/FundConfirmModal', () => ({
  default: () => null,
}));

vi.mock('@/components/LPSettingsModal', () => ({
  default: () => null,
}));

vi.mock('@/components/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// MarketplacePage calls useDocumentTitle(), which reads unreadCount from the
// real NotificationContext - it throws without a provider ancestor. Wrap
// with the real NotificationProvider (established pattern for this
// context) rather than mocking useNotification directly; WalletContext and
// useLPSettings are already mocked above, which is all NotificationProvider
// itself needs.
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

describe('MarketplacePage Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(<MarketplacePage />, { wrapper: TestWrapper });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper heading structure with h1', () => {
    const { container } = render(<MarketplacePage />, { wrapper: TestWrapper });
    const h1Elements = container.querySelectorAll('h1');
    expect(h1Elements.length).toBeGreaterThanOrEqual(1);
    expect(h1Elements[0].textContent).toMatch(/marketplace/i);
  });

  it('should have filter controls with visible label text nearby', () => {
    const { container } = render(<MarketplacePage />, { wrapper: TestWrapper });
    const selects = container.querySelectorAll('select');
    // Each select lives inside a div that also contains a label element
    selects.forEach((select) => {
      const wrapper = select.parentElement;
      const nearbyLabel = wrapper?.querySelector('label');
      // At minimum there should be a visible label text nearby for the control
      expect(nearbyLabel?.textContent?.trim().length).toBeGreaterThan(0);
    });
  });

  it('should have accessible sort buttons with text content', () => {
    const { container } = render(<MarketplacePage />, { wrapper: TestWrapper });
    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      const hasAccessibleName =
        button.textContent?.trim() ||
        button.getAttribute('aria-label') ||
        button.getAttribute('aria-labelledby');
      expect(hasAccessibleName).toBeTruthy();
    });
  });

  it('should have keyboard-navigable sort controls', () => {
    const { container } = render(<MarketplacePage />, { wrapper: TestWrapper });
    const sortButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      ['Yield', 'Amount', 'Due Date'].some((label) => btn.textContent?.includes(label))
    );
    expect(sortButtons.length).toBe(3);
    sortButtons.forEach((btn) => {
      expect(btn.tagName).toBe('BUTTON');
    });
  });

  it('should have proper landmark structure', () => {
    const { getByTestId } = render(<MarketplacePage />, { wrapper: TestWrapper });
    expect(getByTestId('navbar')).toBeInTheDocument();
    const main = document.querySelector('main');
    expect(main).toBeInTheDocument();
  });

  it('should display empty state message when no invoices match filters', () => {
    const { container } = render(<MarketplacePage />, { wrapper: TestWrapper });
    const emptyText = container.querySelector('p');
    expect(emptyText).toBeInTheDocument();
  });
});
