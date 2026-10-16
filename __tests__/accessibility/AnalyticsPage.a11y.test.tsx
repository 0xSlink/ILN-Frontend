/**
 * Per-page accessibility suite for the Analytics page.
 *
 * Split with __tests__/accessibility.test.tsx (see that file's doc comment for the
 * full picture): the Analytics page has no coverage there, so this file is the only
 * a11y suite for it - not a duplicate of anything else.
 */
import { render, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import Providers from '@/app/Providers';
import { NotificationProvider } from '@/context/NotificationContext';
import { useWallet } from '@/context/WalletContext';
import AnalyticsPage from '@/app/analytics/page';

vi.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

const mockWallet = {
  address: null,
  isConnected: false,
  isInstalled: false,
  error: null,
  networkMismatch: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  signTx: vi.fn(),
};

const mockToast = {
  addToast: vi.fn().mockReturnValue('toast-id'),
  updateToast: vi.fn(),
};

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(() => mockWallet),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: vi.fn(() => mockToast),
}));

vi.mock('@/utils/soroban', () => ({
  getAllInvoices: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/components/charts/DynamicAmountHistogram', () => ({
  default: ({ invoices: _invoices }: any) => (
    <div data-testid="amount-histogram">Amount Histogram</div>
  ),
}));

vi.mock('@/components/charts/DynamicFundingChart', () => ({
  default: () => <div data-testid="funding-chart">Funding Chart</div>,
}));

vi.mock('@/components/charts/DynamicDefaultRateChart', () => ({
  default: () => <div data-testid="default-rate-chart">Default Rate Chart</div>,
}));

vi.mock('@/components/ExportButton', () => ({
  ExportButton: ({ data: _data }: any) => <button data-testid="export-button">Export Data</button>,
}));

vi.mock('@/components/AnimatedNumber', () => ({
  default: ({ value, formatter }: any) => <span>{formatter ? formatter(value) : value}</span>,
}));

// Stub the footer, matching the convention used by the other per-page a11y
// suites (HomePage, GovernancePage): its own nested nav/heading markup isn't
// what these tests are about, and left un-stubbed it trips axe's
// heading-order rule against the page's own h1/h2 structure.
vi.mock('@/components/Footer', () => ({
  default: () => <footer data-testid="footer">Footer</footer>,
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>
    <Providers>
      <NotificationProvider>{children}</NotificationProvider>
    </Providers>
  </I18nextProvider>
);

describe('AnalyticsPage Accessibility', () => {
  beforeEach(() => {
    vi.mocked(useWallet).mockReturnValue(mockWallet);
  });

  it('should not have any accessibility violations', async () => {
    const { container } = render(<AnalyticsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(container.querySelector('main')).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper main landmark', async () => {
    const { container } = render(<AnalyticsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      // The dashboard renders a single top-level <main> region for its
      // content (there's no per-page id convention elsewhere in the app -
      // see app/**/page.tsx - so this only checks the landmark itself).
      const main = container.querySelector('main');
      expect(main).toBeInTheDocument();
      expect(main?.tagName).toBe('MAIN');
    });
  });

  it('should show loading state with accessible spinner', async () => {
    // The loading skeleton only renders once a wallet is connected (an
    // unconnected wallet short-circuits to a "Connect your wallet" prompt
    // instead) - use a connected wallet so this test actually exercises the
    // loading branch it claims to cover.
    vi.mocked(useWallet).mockReturnValue({
      ...mockWallet,
      address: 'GTESTFREELANCERADDRESS',
      isConnected: true,
    });

    const { container } = render(<AnalyticsPage />, { wrapper: TestWrapper });

    await waitFor(() => {
      const main = container.querySelector('main');
      const status = main?.querySelector('[role="status"]');
      expect(status).toBeInTheDocument();
      expect(status?.textContent).toMatch(/loading/i);
      expect(status?.querySelector("[aria-hidden='true']")).toBeInTheDocument();
    });
  });
});
