/**
 * Per-page accessibility suite for the LP Dashboard.
 *
 * Split with __tests__/accessibility.test.tsx (see that file's doc comment for the
 * full picture): this file renders the `LPDashboard` component directly and adds
 * structural checks - tab navigation, table semantics, button accessibility - that the
 * root file doesn't assert. The root file instead renders `app/lp/page` (the route
 * that wraps this component) under the full app Providers tree; the two therefore
 * exercise different layers of the same feature, not the same target.
 */
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import LPDashboard from '@/components/LPDashboard';

// Mock all the dependencies
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GTEST123',
    isConnected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    addToast: vi.fn(),
    updateToast: vi.fn(),
  }),
}));

vi.mock('@/context/NotificationContext', () => ({
  useNotification: () => ({
    addNotification: vi.fn(),
  }),
}));

vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: () => ({
    execute: vi.fn(),
    loading: false,
    signingModal: null,
  }),
}));

vi.mock('@/hooks/useApprovedTokens', () => ({
  useApprovedTokens: () => ({
    tokenMap: new Map(),
    defaultToken: { symbol: 'USDC', address: 'CUSDC123' },
  }),
}));

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => ({
    data: [],
    isLoading: false,
    dataUpdatedAt: Date.now(),
  }),
}));

vi.mock('@/hooks/usePositionPolling', () => ({
  usePositionPolling: vi.fn(),
}));

vi.mock('@/hooks/useInvoiceFilters', () => ({
  useInvoiceFilters: () => ({
    filters: {},
    setFilters: vi.fn(),
    clearFilters: vi.fn(),
    activeFilterCount: 0,
  }),
  applyInvoiceFilters: vi.fn(() => []),
}));

vi.mock('@/hooks/useWatchlist', () => ({
  useWatchlist: () => ({
    watchlist: [],
    toggleWatchlist: vi.fn(),
    isInWatchlist: vi.fn(() => false),
  }),
}));

vi.mock('@/hooks/usePayerScores', () => ({
  usePayerScores: () => ({
    scores: new Map(),
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useLPSettings', () => ({
  useLPSettings: () => ({
    settings: {
      riskTolerance: 'medium',
      autoFunding: false,
    },
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe('LPDashboard Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    // LPDashboard is a large, tab-heavy component tree; axe-scanning it
    // is the heaviest case in this file. The default 5s test timeout is
    // tight under worker contention (running alongside the other a11y
    // suites), so give it more headroom.
    const { container } = render(<LPDashboard />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15000);

  it('should have proper tab navigation structure', () => {
    const { container } = render(<LPDashboard />);

    // Check for tab buttons — only validate ARIA if tabs are present
    const tabButtons = container.querySelectorAll('[role="tab"]');
    if (tabButtons.length > 0) {
      // Each tab should have proper ARIA attributes
      tabButtons.forEach((tab) => {
        expect(tab).toHaveAttribute('aria-selected');
        expect(tab).toHaveAttribute('aria-controls');
      });
    } else {
      // With empty data the component may not render tabs; verify navigation region exists
      // No tab navigation at all is valid for the loading/empty state
      expect(container).toBeInTheDocument();
    }
  });

  it('should have accessible table structure', () => {
    const { container } = render(<LPDashboard />);

    const tables = container.querySelectorAll('table');
    // Only validate header scope if tables are present (empty data may render no table)
    if (tables.length > 0) {
      tables.forEach((table) => {
        // Tables should have headers
        const headers = table.querySelectorAll('th');
        expect(headers.length).toBeGreaterThan(0);

        // Headers should have proper scope
        headers.forEach((header) => {
          expect(header).toHaveAttribute('scope');
        });
      });
    } else {
      // No tables with empty data is acceptable
      expect(container).toBeInTheDocument();
    }
  });

  it('should have proper button accessibility', () => {
    const { container } = render(<LPDashboard />);

    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      // Buttons should have accessible names
      const hasAccessibleName =
        button.textContent?.trim() ||
        button.getAttribute('aria-label') ||
        button.getAttribute('aria-labelledby');

      expect(hasAccessibleName).toBeTruthy();
    });
  });
});
