'use client';

import React from 'react';
import { useToast } from '@/context/ToastContext';

/**
 * Example component demonstrating accessible toast usage patterns
 *
 * This component shows best practices for triggering accessible toast notifications
 * that will be announced to screen readers.
 */
export function AccessibleToastExample() {
  const { addToast } = useToast();

  const handleSuccess = () => {
    addToast({
      type: 'success',
      title: 'Invoice submitted successfully',
      message: 'Your invoice will be reviewed by liquidity providers.',
    });
  };

  const handleError = () => {
    addToast({
      type: 'error',
      title: 'Transaction failed',
      message: 'Insufficient balance in your wallet.',
    });
  };

  const handleInfo = () => {
    addToast({
      type: 'info',
      title: 'New feature available',
      message: 'Batch invoice submission is now live!',
    });
  };

  const handleLoading = () => {
    const _toastId = addToast({
      type: 'pending',
      title: 'Processing transaction',
      message: 'Please wait while we confirm your transaction.',
    });

    // Simulate async operation
    setTimeout(() => {
      // In real usage, you would update the existing toast
      // console.log('Would update toast:', _toastId);
    }, 2000);
  };

  const handleComplexMessage = () => {
    addToast({
      type: 'success',
      title: 'Invoice funded with bonus',
      message: (
        <div>
          Invoice #12345 funded with 5% bonus
          <div className="text-sm opacity-80">Tx: 0xabc123...def456</div>
        </div>
      ),
      txHash: '0xabc123def456789',
    });
  };

  return (
    <div className="p-6 border rounded-lg bg-surface-container-low">
      <h2 className="text-lg font-semibold mb-4">Accessible Toast Examples</h2>
      <p className="text-sm text-on-surface-variant mb-6">
        These examples demonstrate toast notifications that will be announced to screen readers.
        Each button triggers a different type of toast with appropriate screen reader announcements.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <h3 className="font-medium">Basic Toast Types</h3>

          <button
            onClick={handleSuccess}
            className="w-full px-4 py-2 bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors"
            aria-label="Trigger success toast notification"
          >
            Success Toast
          </button>

          <button
            onClick={handleError}
            className="w-full px-4 py-2 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-colors"
            aria-label="Trigger error toast notification"
          >
            Error Toast
          </button>

          <button
            onClick={handleInfo}
            className="w-full px-4 py-2 bg-info/10 text-info rounded-lg hover:bg-info/20 transition-colors"
            aria-label="Trigger info toast notification"
          >
            Info Toast
          </button>

          <button
            onClick={handleLoading}
            className="w-full px-4 py-2 bg-warning/10 text-warning rounded-lg hover:bg-warning/20 transition-colors"
            aria-label="Trigger loading toast notification"
          >
            Loading Toast
          </button>
        </div>

        <div className="space-y-4">
          <h3 className="font-medium">Advanced Examples</h3>

          <button
            onClick={handleComplexMessage}
            className="w-full px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
            aria-label="Trigger complex toast with transaction details"
          >
            Complex Toast (with React element)
          </button>

          <div className="p-4 border border-outline-variant/30 rounded-lg bg-surface-variant/10">
            <h4 className="font-medium mb-2">Screen Reader Behavior</h4>
            <ul className="text-sm space-y-1 text-on-surface-variant">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-success text-sm">check_circle</span>
                <span>Success/Info: Polite announcement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-error text-sm">error</span>
                <span>Error: Assertive announcement (interrupts)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-info text-sm">info</span>
                <span>Notifications: Polite announcement of count</span>
              </li>
            </ul>
          </div>

          <div className="p-4 border border-outline-variant/30 rounded-lg bg-surface-variant/10">
            <h4 className="font-medium mb-2">Accessibility Features</h4>
            <ul className="text-sm space-y-1 text-on-surface-variant">
              <li>ARIA live region for announcements</li>
              <li>Screen-reader-only text updates</li>
              <li>Proper politeness levels</li>
              <li>Clear announcement timing</li>
              <li>No duplicate announcements</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-outline-variant/30">
        <h3 className="font-medium mb-3">Implementation Details</h3>
        <div className="text-sm space-y-3 text-on-surface-variant">
          <p>
            <strong>Toast Context:</strong> Manages screen reader announcements via a dedicated ARIA
            live region that updates with toast content.
          </p>
          <p>
            <strong>Notification Bell:</strong> Announces new notification counts to screen readers
            when notifications arrive via polling.
          </p>
          <p>
            <strong>Sonner Integration:</strong> Configured with accessibility attributes to ensure
            proper screen reader behavior.
          </p>
          <p className="text-xs italic">
            Note: For full testing, use actual screen reader software (VoiceOver, NVDA) to verify
            announcements are heard correctly.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Example of notification component with accessibility
 */
export function AccessibleNotificationExample() {
  return (
    <div className="p-6 border rounded-lg bg-surface-container-low mt-6">
      <h2 className="text-lg font-semibold mb-4">Notification Center Accessibility</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-medium mb-3">Notification Bell</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 border border-outline-variant/30 rounded-lg">
              <button
                type="button"
                aria-label="Open notifications"
                aria-expanded="false"
                className="p-2 hover:bg-surface-variant rounded-full"
              >
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <div className="text-sm">
                <p className="font-medium">Default state</p>
                <p className="text-on-surface-variant">No unread notifications</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 border border-outline-variant/30 rounded-lg">
              <button
                type="button"
                aria-label="Open notifications, 3 unread"
                aria-expanded="false"
                className="p-2 hover:bg-surface-variant rounded-full relative"
              >
                <span className="material-symbols-outlined">notifications</span>
                <span
                  aria-hidden
                  className="absolute -right-0.5 -top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-error text-xs text-on-error font-bold"
                >
                  3
                </span>
              </button>
              <div className="text-sm">
                <p className="font-medium">With unread notifications</p>
                <p className="text-on-surface-variant">
                  Announces &quot;3 unread&quot; in button label
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-3">Screen Reader Announcements</h3>
          <div className="p-4 border border-outline-variant/30 rounded-lg bg-surface-variant/10">
            <ul className="text-sm space-y-2">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm">announcement</span>
                <div>
                  <p className="font-medium">New notification arrival</p>
                  <p className="text-on-surface-variant">
                    &quot;1 new notification&quot; announced
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm">
                  label_important
                </span>
                <div>
                  <p className="font-medium">Button state</p>
                  <p className="text-on-surface-variant">Dynamic aria-label with count</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm">
                  accessibility
                </span>
                <div>
                  <p className="font-medium">Drawer accessibility</p>
                  <p className="text-on-surface-variant">Proper focus management and semantics</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="mt-4 p-3 bg-success/5 border border-success/20 rounded-lg">
            <p className="text-sm font-medium text-success">Accessibility Live Region</p>
            <div className="text-xs text-on-surface-variant mt-1">
              Hidden from visual display, available to screen readers:
              <div className="mt-2 font-mono bg-surface-variant/30 p-2 rounded">
                &lt;div role=&quot;status&quot; aria-live=&quot;polite&quot;
                className=&quot;sr-only&quot;&gt;
                <br />
                &nbsp;&nbsp;1 new notification
                <br />
                &lt;/div&gt;
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
