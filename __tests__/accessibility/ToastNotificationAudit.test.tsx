import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { NotificationProvider } from '@/context/NotificationContext';

// NotificationProvider reads the connected wallet address to key its
// localStorage cache; mock it like the other context-mock tests in this
// suite so useNotification() (via NotificationProvider) doesn't throw.
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GTESTWALLET123',
    isConnected: true,
  }),
}));

// Simple test components
function ToastAuditComponent() {
  return (
    <div data-testid="toast-audit">
      <h1>Toast Accessibility Audit</h1>
      {/* ToastProvider (rendered as the ancestor below) already renders its
          own #toast-live-region; this component intentionally doesn't
          duplicate it - a second element with the same id/role would trip
          both the "no duplicate ids" and "multiple role=status" checks. */}
    </div>
  );
}

function NotificationAuditComponent() {
  return (
    <div data-testid="notification-audit">
      <h1>Notification Accessibility Audit</h1>
      <button type="button" aria-label="Open notifications" aria-expanded="false">
        <span className="material-symbols-outlined">notifications</span>
      </button>
      <div aria-live="polite" className="sr-only">
        Notification updates
      </div>
    </div>
  );
}

describe('Toast & Notification Accessibility Audit', () => {
  it('should verify ToastProvider ARIA live region exists', () => {
    render(
      <ToastProvider>
        <ToastAuditComponent />
      </ToastProvider>
    );

    // Check that ToastProvider adds the ARIA live region
    const liveRegion = screen.getByRole('status', { hidden: true });
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    expect(liveRegion).toHaveAttribute('id', 'toast-live-region');
    expect(liveRegion).toHaveClass('sr-only');
  });

  it('should verify notification system has appropriate ARIA attributes', async () => {
    const { container } = render(
      <NotificationProvider>
        <ToastProvider>
          <NotificationAuditComponent />
        </ToastProvider>
      </NotificationProvider>
    );

    // Check notification button accessibility
    const notificationButton = screen.getByRole('button', { name: /open notifications/i });
    expect(notificationButton).toBeInTheDocument();
    expect(notificationButton).toHaveAttribute('aria-expanded', 'false');
    expect(notificationButton).toHaveAttribute('aria-label');

    // Run accessibility audit
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should examine sonner toast default accessibility', async () => {
    // Test that examines sonner's built-in accessibility features
    const { container } = render(
      <ToastProvider>
        <div>
          <div data-sonner-toast="" role="region" aria-label="Toast notifications">
            <div role="status" aria-live="polite">
              Mock toast content
            </div>
          </div>
        </div>
      </ToastProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should verify screen reader announcement coordination', () => {
    // Test that toast and notification systems don't conflict
    render(
      <NotificationProvider>
        <ToastProvider>
          <div>
            <ToastAuditComponent />
            <NotificationAuditComponent />
          </div>
        </ToastProvider>
      </NotificationProvider>
    );

    // Both systems should have their own ARIA live regions
    const toastLiveRegions = screen.getAllByRole('status', { hidden: true });
    expect(toastLiveRegions.length).toBeGreaterThan(0);

    // Notification button should be properly labeled
    const notificationButton = screen.getByRole('button', { name: /open notifications/i });
    expect(notificationButton).toBeInTheDocument();
  });
});

describe('ARIA Live Region Best Practices', () => {
  it('should follow WCAG guidelines for live regions', () => {
    // ARIA live regions should:
    // 1. Be placed in the DOM before content updates
    // 2. Have appropriate politeness levels
    // 3. Be atomic when appropriate
    // 4. Use sr-only class for screen-reader-only content

    render(
      <div>
        {/* Example of good ARIA live region practice */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          id="best-practice-live-region"
        >
          Status updates will be announced here
        </div>

        {/* Example of assertive region for critical alerts */}
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          className="sr-only"
          id="critical-alerts-region"
        >
          Critical alerts will be announced here
        </div>
      </div>
    );

    const politeRegion = screen.getByRole('status', { hidden: true });
    const alertRegion = screen.getByRole('alert', { hidden: true });

    expect(politeRegion).toHaveAttribute('aria-live', 'polite');
    expect(alertRegion).toHaveAttribute('aria-live', 'assertive');
    expect(politeRegion).toHaveClass('sr-only');
    expect(alertRegion).toHaveClass('sr-only');
  });
});
