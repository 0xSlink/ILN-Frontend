import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationBell from '../NotificationBell';

const walletState = { address: 'GADDR' as string | null, isConnected: true };
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

const notificationState = {
  setNotifications: vi.fn(),
  unreadCount: 0,
  isRead: vi.fn(() => false),
  markAllAsRead: vi.fn(),
};
vi.mock('@/context/NotificationContext', () => ({
  useNotification: () => notificationState,
  type: {},
}));

vi.mock('../NotificationDrawer', () => ({
  default: () => <div>drawer</div>,
}));

const fetchMock = vi.fn();
const REAL_FETCH = global.fetch;

// Flush microtasks so mocked fetch promises resolve and state updates apply.
const flush = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });

describe('NotificationBell', () => {
  beforeEach(() => {
    // Strict fake timers: the component's 60s poll never fires in tests, so no
    // stray callback hits a reset fetch mock after the test completes.
    vi.useFakeTimers();
    walletState.address = 'GADDR';
    walletState.isConnected = true;
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    notificationState.setNotifications.mockClear();
  });

  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    (global as any).fetch = REAL_FETCH;
    vi.useRealTimers();
  });

  it('renders null when the wallet is not connected', () => {
    walletState.isConnected = false;
    const { container } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fetches and merges notifications on a healthy response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: 'n1',
          type: 'funded',
          title: 'Invoice funded',
          message: 'msg',
          createdAt: '2026-01-01T00:00:00Z',
          read: false,
        },
      ],
    });

    render(<NotificationBell />);
    await flush();

    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/GADDR');
    expect(notificationState.setNotifications).toHaveBeenCalled();
    expect(screen.queryByTestId('notification-service-unavailable')).not.toBeInTheDocument();
  });

  it('categorizes incoming admin and governance events for the category filters', async () => {
    const base = { title: 't', message: 'm', createdAt: '2026-01-01T00:00:00Z', read: false };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { ...base, id: 'a1', category: 'admin', type: 'info' },
        { ...base, id: 'a2', type: 'signer_rotation' },
        { ...base, id: 'g1', type: 'proposal' },
        { ...base, id: 'i1', category: 'not-a-category', type: 'funded' },
      ],
    });

    render(<NotificationBell />);
    await flush();

    const updater = notificationState.setNotifications.mock.calls[0][0] as (
      previous: unknown[]
    ) => Array<{ id: string; category: string }>;
    const merged = Object.fromEntries(updater([]).map((n) => [n.id, n.category]));
    expect(merged).toEqual({ a1: 'admin', a2: 'admin', g1: 'governance', i1: 'invoice' });
  });

  it('keeps cached state and signals degradation on a 503 (circuit open), never clearing notifications', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    render(<NotificationBell />);
    await flush();

    // A degraded service must NOT clear or replace cached notifications.
    expect(screen.getByTestId('notification-service-unavailable')).toBeInTheDocument();
    expect(notificationState.setNotifications).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /temporarily unavailable/i })).toBeInTheDocument();
  });

  it('signals degradation on a 429 (rate limited) response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 });

    render(<NotificationBell />);
    await flush();

    expect(screen.getByTestId('notification-service-unavailable')).toBeInTheDocument();
    expect(notificationState.setNotifications).not.toHaveBeenCalled();
  });

  it('recovers (clears the degraded indicator) once the service is healthy again', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true, status: 200, json: async () => [] });

    render(<NotificationBell />);
    await flush();

    expect(screen.getByTestId('notification-service-unavailable')).toBeInTheDocument();

    // Trigger the component's next 60s poll, which now returns healthy.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await flush();

    expect(screen.queryByTestId('notification-service-unavailable')).not.toBeInTheDocument();
  });

  it('does not re-poll the notifications service when read state changes', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    const { isRead, setNotifications } = notificationState;

    const { rerender } = render(<NotificationBell />);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Marking a notification read hands the bell new context callbacks.
    notificationState.isRead = vi.fn(() => true);
    notificationState.setNotifications = vi.fn();
    rerender(<NotificationBell />);
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    notificationState.isRead = isRead;
    notificationState.setNotifications = setNotifications;
  });

  it('ignores a poll that resolves after the wallet changed', async () => {
    let resolveFirstPoll: (value: unknown) => void = () => {};
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          new Promise((resolve) => {
            resolveFirstPoll = resolve;
          }),
      })
      .mockResolvedValue({ ok: false, status: 503 });

    const { rerender } = render(<NotificationBell />);
    await flush();

    walletState.address = 'GOTHER';
    rerender(<NotificationBell />);
    await flush();

    await act(async () => {
      resolveFirstPoll([
        {
          id: 'previous-wallet',
          type: 'funded',
          title: 'Invoice funded',
          message: 'msg',
          createdAt: '2026-01-01T00:00:00Z',
          read: false,
        },
      ]);
    });
    await flush();

    expect(fetchMock).toHaveBeenLastCalledWith('/api/notifications/GOTHER');
    expect(notificationState.setNotifications).not.toHaveBeenCalled();
  });
});
