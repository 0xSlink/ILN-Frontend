import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotificationProvider, useNotification } from '../NotificationContext';
import { MAX_NOTIFICATIONS } from '@/utils/notificationHelpers';

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({ address: 'GTESTWALLET123' }),
}));

const notificationsKey = 'iln-notifications:GTESTWALLET123';
const readKey = 'iln-notification-read:GTESTWALLET123';

function seedNotifications(ids: string[]) {
  localStorage.setItem(
    notificationsKey,
    JSON.stringify(
      ids.map((id, index) => ({
        id,
        category: 'invoice',
        type: 'funded',
        title: `Notification ${id}`,
        message: 'Invoice funded',
        href: '/dashboard',
        createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
        read: false,
      }))
    )
  );
}

describe('NotificationContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds notifications and tracks unread count', () => {
    const { result } = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    act(() => {
      result.current.addNotification({
        id: 'invoice-1-paid',
        category: 'invoice',
        type: 'settled',
        title: 'Invoice paid',
        message: 'Invoice #1 was paid.',
        href: '/freelancer',
      });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
  });

  it('persists read state by notification id', () => {
    const { result } = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    act(() => {
      result.current.addNotification({
        id: 'gov-1',
        category: 'governance',
        type: 'proposal',
        title: 'Proposal passed',
        message: 'A proposal passed.',
        href: '/governance/1',
      });
    });

    act(() => {
      result.current.markAsRead('gov-1');
    });

    expect(result.current.isRead('gov-1')).toBe(true);
    expect(result.current.unreadCount).toBe(0);

    const readKey = 'iln-notification-read:GTESTWALLET123';
    const stored = JSON.parse(localStorage.getItem(readKey) ?? '{}');
    expect(stored['gov-1']).toBe(true);
  });

  it('marks all notifications as read', () => {
    const { result } = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    act(() => {
      result.current.addNotification({
        id: 'a',
        category: 'lp',
        type: 'funded',
        title: 'Funded',
        message: 'Position funded',
        href: '/dashboard',
      });
      result.current.addNotification({
        id: 'b',
        category: 'reputation',
        type: 'reputation',
        title: 'Score change',
        message: 'Reputation updated',
        href: '/freelancer',
      });
    });

    act(() => {
      result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  it('restores read state after a reload', () => {
    seedNotifications(['n1', 'n2']);
    const firstLoad = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    act(() => {
      firstLoad.result.current.markAsRead('n1');
    });
    firstLoad.unmount();

    const reloaded = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    expect(reloaded.result.current.isRead('n1')).toBe(true);
    expect(reloaded.result.current.notifications.find((n) => n.id === 'n1')?.read).toBe(true);
    expect(reloaded.result.current.unreadCount).toBe(1);
  });

  it('keeps reads saved by another tab when a tab with stale state marks a notification read', () => {
    seedNotifications(['n1', 'n2']);
    const tabA = renderHook(() => useNotification(), { wrapper: NotificationProvider });
    // Storage events never reach the writing window, so tab B stays stale.
    const tabB = renderHook(() => useNotification(), { wrapper: NotificationProvider });

    act(() => {
      tabA.result.current.markAsRead('n1');
    });
    act(() => {
      tabB.result.current.markAsRead('n2');
    });

    expect(JSON.parse(localStorage.getItem(readKey) ?? '{}')).toEqual({ n1: true, n2: true });
    expect(tabB.result.current.unreadCount).toBe(0);

    tabA.unmount();
    tabB.unmount();
    const reloaded = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    expect(reloaded.result.current.unreadCount).toBe(0);
  });

  it('applies read state written by another tab', () => {
    seedNotifications(['n1', 'n2']);
    const { result } = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    expect(result.current.unreadCount).toBe(2);

    act(() => {
      localStorage.setItem(readKey, JSON.stringify({ n1: true }));
      window.dispatchEvent(new StorageEvent('storage', { key: readKey }));
    });

    expect(result.current.isRead('n1')).toBe(true);
    expect(result.current.notifications.find((n) => n.id === 'n1')?.read).toBe(true);
    expect(result.current.unreadCount).toBe(1);
  });

  it('caps an oversized stored history on load so the in-memory list stays bounded', async () => {
    seedNotifications(Array.from({ length: 5000 }, (_, index) => `n-${index}`));

    const { result } = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    await waitFor(() => expect(result.current.notifications.length).toBeGreaterThan(0));
    expect(result.current.notifications).toHaveLength(MAX_NOTIFICATIONS);
    expect(result.current.unreadCount).toBe(MAX_NOTIFICATIONS);
  });

  it('caps a high-volume bulk replace at MAX_NOTIFICATIONS', () => {
    const { result } = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    act(() => {
      result.current.setNotifications(
        Array.from({ length: 5000 }, (_, index) => ({
          id: `bulk-${index}`,
          category: 'lp' as const,
          type: 'info' as const,
          title: `Bulk ${index}`,
          message: 'LP event',
          href: '/lp',
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
          read: false,
        }))
      );
    });

    expect(result.current.notifications).toHaveLength(MAX_NOTIFICATIONS);
    const persisted = JSON.parse(localStorage.getItem(notificationsKey) ?? '[]');
    expect(persisted).toHaveLength(MAX_NOTIFICATIONS);
  });
});
