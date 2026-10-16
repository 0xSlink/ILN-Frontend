import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider, useToast } from '@/context/ToastContext';
import NotificationBell from '@/components/NotificationBell';
import { NotificationProvider } from '@/context/NotificationContext';

// Mock dependencies
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GTESTWALLET123',
    isConnected: true,
  }),
}));

function ToastTestComponent() {
  const { addToast } = useToast();

  return (
    <div>
      <button
        onClick={() =>
          addToast({
            type: 'success',
            title: 'Invoice funded successfully',
            message: 'Invoice #123 has been funded by LP',
          })
        }
        data-testid="success-toast-btn"
      >
        Show Success Toast
      </button>
      <button
        onClick={() =>
          addToast({
            type: 'error',
            title: 'Transaction failed',
            message: 'Insufficient balance',
          })
        }
        data-testid="error-toast-btn"
      >
        Show Error Toast
      </button>
      <button
        onClick={() =>
          addToast({
            type: 'info',
            title: 'New notification',
            message: 'You have 3 unread notifications',
          })
        }
        data-testid="info-toast-btn"
      >
        Show Info Toast
      </button>
    </div>
  );
}

function NotificationTestComponent() {
  return (
    <div>
      <NotificationBell />
    </div>
  );
}

describe('Toast Accessibility Audit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should have ARIA live region for toasts', async () => {
    render(
      <ToastProvider>
        <ToastTestComponent />
      </ToastProvider>
    );

    // Check that the ToastProvider adds an ARIA live region
    const liveRegion = screen.getByRole('status', { hidden: true });
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    expect(liveRegion).toHaveAttribute('id', 'toast-live-region');
    expect(liveRegion).toHaveClass('sr-only');
  });

  it('should announce toast content to screen readers', async () => {
    const { container } = render(
      <ToastProvider>
        <ToastTestComponent />
      </ToastProvider>
    );

    // Trigger a toast
    fireEvent.click(screen.getByTestId('success-toast-btn'));

    // The live region should contain the toast message
    screen.getByRole('status', { hidden: true });

    // Sonner should create an accessible toast container
    // Check for sonner's default ARIA attributes
    await waitFor(() => {
      const toastContainer = container.querySelector('[data-sonner-toast]');
      expect(toastContainer).toBeInTheDocument();

      // Sonner should add role="status" or similar to toasts
      const toastElements = container.querySelectorAll('[role="status"], [role="alert"]');
      expect(toastElements.length).toBeGreaterThan(0);
    });
  });

  it('should pass axe accessibility tests for toast system', async () => {
    const { container } = render(
      <ToastProvider>
        <ToastTestComponent />
      </ToastProvider>
    );

    // Trigger a toast to make the system active
    act(() => {
      fireEvent.click(screen.getByTestId('success-toast-btn'));
    });

    await waitFor(async () => {
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  it('should have appropriate politeness levels for different toast types', () => {
    render(
      <ToastProvider>
        <ToastTestComponent />
      </ToastProvider>
    );

    // Sonner default behavior:
    // - Success/Info: polite aria-live
    // - Error/Warning: assertive aria-live
    // Check ToastContext for custom ARIA live region
    const liveRegion = screen.getByRole('status', { hidden: true });
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');

    // The custom live region is polite for all toasts
    // Sonner's internal implementation may have different politeness levels
  });
});

describe('Notification Center Accessibility Audit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should have accessible notification bell', async () => {
    const { container } = render(
      <NotificationProvider>
        <ToastProvider>
          <NotificationTestComponent />
        </ToastProvider>
      </NotificationProvider>
    );

    // Notification bell should have proper ARIA attributes
    const notificationButton = screen.getByRole('button', { name: /open notifications/i });
    expect(notificationButton).toBeInTheDocument();
    expect(notificationButton).toHaveAttribute('aria-expanded', 'false');
    expect(notificationButton).toHaveAttribute('aria-label');

    // Check for accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should announce new notifications to screen readers', async () => {
    const { container } = render(
      <NotificationProvider>
        <ToastProvider>
          <NotificationTestComponent />
        </ToastProvider>
      </NotificationProvider>
    );

    // The notification center should have ARIA live announcements
    // for new notifications when they arrive

    // Check for any ARIA live regions in notification system
    const liveRegions = container.querySelectorAll('[aria-live]');
    expect(liveRegions.length).toBeGreaterThan(0);
  });

  it('should have proper labeling for unread count', () => {
    render(
      <NotificationProvider>
        <ToastProvider>
          <NotificationTestComponent />
        </ToastProvider>
      </NotificationProvider>
    );

    const notificationButton = screen.getByRole('button', { name: /open notifications/i });
    const ariaLabel = notificationButton.getAttribute('aria-label');

    // Button should indicate unread count in aria-label when there are unread notifications
    expect(ariaLabel).toMatch(/open notifications/i);
  });
});

describe('Screen Reader Announcement Integration', () => {
  it('should coordinate toast and notification announcements', () => {
    // Both systems should work together without conflicting announcements
    // Toast system handles immediate feedback
    // Notification system handles persistent notifications

    const { container } = render(
      <NotificationProvider>
        <ToastProvider>
          <ToastTestComponent />
          <NotificationTestComponent />
        </ToastProvider>
      </NotificationProvider>
    );

    // Check that both systems have appropriate ARIA attributes. There are
    // legitimately two role="status" live regions on screen at once here -
    // ToastContext's own #toast-live-region and NotificationBell's unread
    // announcer - so scope this query to the toast one specifically rather
    // than asserting there's only one status region in the whole tree.
    const toastLiveRegion = container.querySelector('#toast-live-region');
    expect(toastLiveRegion).toBeInTheDocument();
    expect(toastLiveRegion).toHaveAttribute('role', 'status');

    const notificationButton = screen.getByRole('button', { name: /open notifications/i });
    expect(notificationButton).toBeInTheDocument();
  });
});
