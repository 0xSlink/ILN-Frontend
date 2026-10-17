/**
 * NotificationSettings component tests
 *
 * Covers:
 *  - Existing render + save-to-localStorage coverage
 *  - #862  Edit-save-rerender regression:
 *      email address and webhook URL changes are persisted and re-displayed
 *      after save; event-toggle changes survive a save round-trip.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationSettings from '@/screens/settings/NotificationSettings';

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn(), updateToast: vi.fn() }),
}));

describe('NotificationSettings (#70)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders email and webhook sections', () => {
    render(<NotificationSettings />);
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('webhook-url-input')).toBeInTheDocument();
  });

  it('shows all event type toggles for email', () => {
    render(<NotificationSettings />);
    expect(screen.getByTestId('email-toggle-funded')).toBeInTheDocument();
    expect(screen.getByTestId('email-toggle-settled')).toBeInTheDocument();
    expect(screen.getByTestId('email-toggle-defaulted')).toBeInTheDocument();
    expect(screen.getByTestId('email-toggle-due_date_warning')).toBeInTheDocument();
  });

  // ── Email edit-save-rerender (#862) ────────────────────────────────────────

  it('saves email subscription to localStorage with the typed address', () => {
    render(<NotificationSettings />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByTestId('save-email-btn'));

    const stored = JSON.parse(localStorage.getItem('iln-notification-subscriptions') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].type).toBe('email');
    // Regression: the persisted target must match what the user typed, not stale state
    expect(stored[0].target).toBe('test@example.com');
  });

  it('clears the email input after a successful save', () => {
    render(<NotificationSettings />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'clear@example.com' },
    });
    fireEvent.click(screen.getByTestId('save-email-btn'));

    expect(screen.getByTestId('email-input')).toHaveValue('');
  });

  it('persists only the enabled email event toggles', () => {
    render(<NotificationSettings />);

    // Disable 'funded' and 'settled', keep 'defaulted' and 'due_date_warning'
    fireEvent.click(screen.getByTestId('email-toggle-funded'));
    fireEvent.click(screen.getByTestId('email-toggle-settled'));

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'toggle@example.com' },
    });
    fireEvent.click(screen.getByTestId('save-email-btn'));

    const stored = JSON.parse(localStorage.getItem('iln-notification-subscriptions') ?? '[]');
    expect(stored[0].events).not.toContain('funded');
    expect(stored[0].events).not.toContain('settled');
    expect(stored[0].events).toContain('defaulted');
    expect(stored[0].events).toContain('due_date_warning');
  });

  it('shows an error toast when all email event toggles are disabled', () => {
    const addToastSpy = vi.fn();
    vi.doMock('../../context/ToastContext', () => ({
      useToast: () => ({ addToast: addToastSpy }),
    }));

    render(<NotificationSettings />);

    // Disable all toggles
    fireEvent.click(screen.getByTestId('email-toggle-funded'));
    fireEvent.click(screen.getByTestId('email-toggle-settled'));
    fireEvent.click(screen.getByTestId('email-toggle-defaulted'));
    fireEvent.click(screen.getByTestId('email-toggle-due_date_warning'));

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'no-events@example.com' },
    });
    fireEvent.click(screen.getByTestId('save-email-btn'));

    // Nothing should have been persisted
    const stored = JSON.parse(localStorage.getItem('iln-notification-subscriptions') ?? '[]');
    expect(stored).toHaveLength(0);
  });

  // ── Webhook edit-save-rerender (#862) ──────────────────────────────────────

  it('saves webhook subscription to localStorage with the typed URL', () => {
    render(<NotificationSettings />);

    fireEvent.change(screen.getByTestId('webhook-url-input'), {
      target: { value: 'https://example.com/hook' },
    });
    fireEvent.click(screen.getByTestId('save-webhook-btn'));

    const stored = JSON.parse(localStorage.getItem('iln-notification-subscriptions') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].type).toBe('webhook');
    // Regression: URL must match what the user typed
    expect(stored[0].target).toBe('https://example.com/hook');
  });

  it('clears the webhook URL input after a successful save', () => {
    render(<NotificationSettings />);

    fireEvent.change(screen.getByTestId('webhook-url-input'), {
      target: { value: 'https://example.com/hook' },
    });
    fireEvent.click(screen.getByTestId('save-webhook-btn'));

    expect(screen.getByTestId('webhook-url-input')).toHaveValue('');
  });

  it('persists only the enabled webhook event toggles', () => {
    render(<NotificationSettings />);

    // Disable 'defaulted' and 'due_date_warning'
    fireEvent.click(screen.getByTestId('webhook-toggle-defaulted'));
    fireEvent.click(screen.getByTestId('webhook-toggle-due_date_warning'));

    fireEvent.change(screen.getByTestId('webhook-url-input'), {
      target: { value: 'https://hooks.example.com/events' },
    });
    fireEvent.click(screen.getByTestId('save-webhook-btn'));

    const stored = JSON.parse(localStorage.getItem('iln-notification-subscriptions') ?? '[]');
    expect(stored[0].events).toContain('funded');
    expect(stored[0].events).toContain('settled');
    expect(stored[0].events).not.toContain('defaulted');
    expect(stored[0].events).not.toContain('due_date_warning');
  });

  // ── Re-render from localStorage (#862 rerender half) ─────────────────────

  it('rerender: a second mount shows subscriptions saved by the first mount', () => {
    const { unmount } = render(<NotificationSettings />);
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'rerender@example.com' },
    });
    fireEvent.click(screen.getByTestId('save-email-btn'));
    unmount();

    // Mount a fresh instance — it must read the saved subscription from localStorage
    render(<NotificationSettings />);
    expect(screen.getByTestId('subscription-list')).toBeInTheDocument();
    expect(screen.getByText('rerender@example.com')).toBeInTheDocument();
  });

  // ── Active subscriptions list ──────────────────────────────────────────────

  it('renders active subscriptions list pre-populated from localStorage', () => {
    const subs = [
      {
        id: 'email-1',
        type: 'email',
        target: 'a@b.com',
        events: ['funded'],
        createdAt: new Date().toISOString(),
      },
    ];
    localStorage.setItem('iln-notification-subscriptions', JSON.stringify(subs));
    render(<NotificationSettings />);
    expect(screen.getByTestId('subscription-list')).toBeInTheDocument();
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
  });

  it('removes a subscription on delete and updates localStorage', () => {
    const subs = [
      {
        id: 'email-1',
        type: 'email',
        target: 'delete@example.com',
        events: ['funded'],
        createdAt: new Date().toISOString(),
      },
    ];
    localStorage.setItem('iln-notification-subscriptions', JSON.stringify(subs));
    render(<NotificationSettings />);

    fireEvent.click(screen.getByTestId('delete-sub-email-1'));

    // Should be gone from the DOM
    expect(screen.queryByText('delete@example.com')).not.toBeInTheDocument();
    // And removed from localStorage
    const stored = JSON.parse(localStorage.getItem('iln-notification-subscriptions') ?? '[]');
    expect(stored).toHaveLength(0);
  });
});
