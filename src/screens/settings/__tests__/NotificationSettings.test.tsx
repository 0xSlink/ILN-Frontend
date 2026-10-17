import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationSettings from '../NotificationSettings';

const addToastMock = vi.fn();
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock, updateToast: vi.fn() }),
}));

const STORAGE_KEY = 'iln-notification-subscriptions';

function readStored() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
}

function storedFor(target: string) {
  return readStored().find((s: { target: string }) => s.target === target);
}

describe('NotificationSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    addToastMock.mockClear();
  });

  describe('email subscriptions', () => {
    it('rejects an address that is not an email without persisting anything', () => {
      render(<NotificationSettings />);
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'not-an-email' } });
      fireEvent.click(screen.getByTestId('save-email-btn'));

      expect(addToastMock).toHaveBeenCalledWith({
        type: 'error',
        title: 'Please enter a valid email address.',
      });
      expect(readStored()).toEqual([]);
    });

    it('rejects a save when every event toggle is cleared', () => {
      render(<NotificationSettings />);
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'a@b.com' } });
      for (const key of ['funded', 'settled', 'defaulted', 'due_date_warning']) {
        fireEvent.click(screen.getByTestId(`email-toggle-${key}`));
      }
      fireEvent.click(screen.getByTestId('save-email-btn'));

      expect(addToastMock).toHaveBeenCalledWith({
        type: 'error',
        title: 'Select at least one event type.',
      });
      expect(readStored()).toEqual([]);
    });

    it('persists only the enabled events and clears the input on success', async () => {
      render(<NotificationSettings />);
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'lp@example.com' } });
      fireEvent.click(screen.getByTestId('email-toggle-defaulted'));
      fireEvent.click(screen.getByTestId('save-email-btn'));

      await waitFor(() => expect(readStored()).toHaveLength(1));
      const sub = storedFor('lp@example.com');
      expect(sub).toMatchObject({
        type: 'email',
        events: ['funded', 'settled', 'due_date_warning'],
      });
      expect(sub.id).toMatch(/^email-\d+$/);
      expect(Number.isNaN(Date.parse(sub.createdAt))).toBe(false);
      expect(screen.getByTestId('email-input')).toHaveValue('');
      expect(addToastMock).toHaveBeenCalledWith({
        type: 'success',
        title: 'Email subscription saved.',
      });
    });
  });

  describe('webhook subscriptions', () => {
    it('rejects a target that is not an http(s) URL', () => {
      render(<NotificationSettings />);
      fireEvent.change(screen.getByTestId('webhook-url-input'), {
        target: { value: 'ftp://example.com' },
      });
      fireEvent.click(screen.getByTestId('save-webhook-btn'));

      expect(addToastMock).toHaveBeenCalledWith({
        type: 'error',
        title: 'Please enter a valid webhook URL.',
      });
      expect(readStored()).toEqual([]);
    });

    it('rejects a webhook save when every event toggle is cleared', () => {
      render(<NotificationSettings />);
      fireEvent.change(screen.getByTestId('webhook-url-input'), {
        target: { value: 'https://example.com/hook' },
      });
      for (const key of ['funded', 'settled', 'defaulted', 'due_date_warning']) {
        fireEvent.click(screen.getByTestId(`webhook-toggle-${key}`));
      }
      fireEvent.click(screen.getByTestId('save-webhook-btn'));

      expect(addToastMock).toHaveBeenCalledWith({
        type: 'error',
        title: 'Select at least one event type.',
      });
      expect(readStored()).toEqual([]);
    });

    it('persists a webhook subscription and clears the input on success', async () => {
      render(<NotificationSettings />);
      fireEvent.change(screen.getByTestId('webhook-url-input'), {
        target: { value: 'https://example.com/hook' },
      });
      fireEvent.click(screen.getByTestId('save-webhook-btn'));

      await waitFor(() => expect(readStored()).toHaveLength(1));
      expect(storedFor('https://example.com/hook')).toMatchObject({ type: 'webhook' });
      expect(screen.getByTestId('webhook-url-input')).toHaveValue('');
      expect(addToastMock).toHaveBeenCalledWith({
        type: 'success',
        title: 'Webhook subscription saved.',
      });
    });

    it('sends a test payload and reports success', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);

      render(<NotificationSettings />);
      fireEvent.change(screen.getByTestId('webhook-url-input'), {
        target: { value: 'https://example.com/hook' },
      });
      fireEvent.click(screen.getByTestId('test-webhook-btn'));

      await waitFor(() =>
        expect(addToastMock).toHaveBeenCalledWith({
          type: 'success',
          title: 'Test webhook sent successfully.',
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({ method: 'POST' })
      );
      // The button re-enables once the request settles.
      await waitFor(() => expect(screen.getByTestId('test-webhook-btn')).not.toBeDisabled());

      vi.unstubAllGlobals();
    });

    it('surfaces a failure and re-enables the button when the test request rejects', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
      vi.stubGlobal('fetch', fetchMock);

      render(<NotificationSettings />);
      fireEvent.change(screen.getByTestId('webhook-url-input'), {
        target: { value: 'https://example.com/hook' },
      });
      fireEvent.click(screen.getByTestId('test-webhook-btn'));

      await waitFor(() =>
        expect(addToastMock).toHaveBeenCalledWith({
          type: 'error',
          title: 'Webhook test failed. Check the URL.',
        })
      );
      await waitFor(() => expect(screen.getByTestId('test-webhook-btn')).not.toBeDisabled());

      vi.unstubAllGlobals();
    });

    it('refuses to send a test request for an invalid URL', () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      render(<NotificationSettings />);
      fireEvent.change(screen.getByTestId('webhook-url-input'), {
        target: { value: 'example.com' },
      });
      fireEvent.click(screen.getByTestId('test-webhook-btn'));

      expect(addToastMock).toHaveBeenCalledWith({
        type: 'error',
        title: 'Enter a valid webhook URL first.',
      });
      expect(fetchMock).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe('active subscriptions', () => {
    it('shows the empty state when nothing is stored', async () => {
      render(<NotificationSettings />);
      await waitFor(() => expect(screen.getByText('No active subscriptions.')).toBeInTheDocument());
      expect(screen.queryByTestId('subscription-list')).not.toBeInTheDocument();
    });

    it('restores stored subscriptions on mount and removes one without dropping the rest', async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          { id: 'email-1', type: 'email', target: 'a@b.com', events: ['funded'], createdAt: '' },
          {
            id: 'webhook-2',
            type: 'webhook',
            target: 'https://example.com/hook',
            events: ['settled', 'disputed' as never],
            createdAt: '',
          },
        ])
      );

      render(<NotificationSettings />);
      await waitFor(() => expect(screen.getByTestId('subscription-list')).toBeInTheDocument());
      expect(screen.getByText('a@b.com')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/hook')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('delete-sub-email-1'));

      expect(readStored().map((s: { id: string }) => s.id)).toEqual(['webhook-2']);
      expect(addToastMock).toHaveBeenCalledWith({
        type: 'success',
        title: 'Subscription removed.',
      });
      await waitFor(() => expect(screen.queryByText('a@b.com')).not.toBeInTheDocument());
      expect(screen.getByText('https://example.com/hook')).toBeInTheDocument();
    });

    it('falls back to an empty list when stored JSON is corrupt', async () => {
      localStorage.setItem(STORAGE_KEY, '{not json');

      render(<NotificationSettings />);
      await waitFor(() => expect(screen.getByText('No active subscriptions.')).toBeInTheDocument());
    });
  });
});
