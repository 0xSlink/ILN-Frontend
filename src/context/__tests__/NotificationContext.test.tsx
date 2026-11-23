import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotificationProvider, useNotification } from '../NotificationContext';
import { MAX_NOTIFICATIONS } from '@/utils/notificationHelpers';

let mockWalletAddress: string | null = 'GTESTWALLET123';

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({ address: mockWalletAddress }),
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
    mockWalletAddress = 'GTESTWALLET123';
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

  // ─── Duplicate events tests ────────────────────────────────────────────────

  it('deduplicates identical events without mutating createdAt, unreadCount, or list order', () => {
    const { result } = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    let firstAdded: any;
    act(() => {
      firstAdded = result.current.addNotification({
        id: 'dup-1',
        category: 'invoice',
        type: 'funded',
        title: 'Invoice Funded',
        message: 'Funded with 500 USDC',
        href: '/dashboard',
      });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
    const originalCreatedAt = firstAdded.createdAt;

    // Add a second unrelated notification
    act(() => {
      result.current.addNotification({
        id: 'unrelated-2',
        category: 'governance',
        type: 'proposal',
        title: 'Proposal',
        message: 'New proposal',
        href: '/gov',
      });
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.notifications[0].id).toBe('unrelated-2');
    expect(result.current.notifications[1].id).toBe('dup-1');

    // Simulate replay of duplicate event (e.g. from indexer poll or stream reconnection)
    let replayed: any;
    act(() => {
      replayed = result.current.addNotification({
        id: 'dup-1',
        category: 'invoice',
        type: 'funded',
        title: 'Invoice Funded',
        message: 'Funded with 500 USDC',
        href: '/dashboard',
      });
    });

    // Length remains 2, unreadCount remains 2, order is preserved (dup-1 not pulled to top),
    // and createdAt timestamp is intact.
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.notifications[1].id).toBe('dup-1');
    expect(result.current.notifications[1].createdAt).toBe(originalCreatedAt);
    expect(replayed.createdAt).toBe(originalCreatedAt);
  });

  it('does not reset read state when an identical event is re-emitted', () => {
    const { result } = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    act(() => {
      result.current.addNotification({
        id: 'read-test',
        category: 'invoice',
        type: 'settled',
        title: 'Settled',
        message: 'Invoice settled',
        href: '/dashboard',
      });
    });

    act(() => {
      result.current.markAsRead('read-test');
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.isRead('read-test')).toBe(true);

    // Duplicate event emitted
    act(() => {
      result.current.addNotification({
        id: 'read-test',
        category: 'invoice',
        type: 'settled',
        title: 'Settled',
        message: 'Invoice settled',
        href: '/dashboard',
      });
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.isRead('read-test')).toBe(true);
    expect(result.current.notifications[0].read).toBe(true);
  });

  // ─── Reorg-corrected notifications tests ───────────────────────────────────

  it('updates notification in place and alerts user when a reorg-corrected event arrives', () => {
    const { result } = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    act(() => {
      result.current.addNotification({
        id: 'invoice-101',
        category: 'invoice',
        type: 'settled',
        title: 'Invoice #101 settled',
        message: 'Invoice #101 was marked paid on block 12000.',
        href: '/freelancer',
      });
    });

    act(() => {
      result.current.markAsRead('invoice-101');
    });

    expect(result.current.unreadCount).toBe(0);

    // Ledger reorg occurs: the transaction was disputed or rolled back in block 12000b
    act(() => {
      result.current.addNotification({
        id: 'invoice-101',
        category: 'invoice',
        type: 'disputed',
        title: 'Invoice #101 disputed (reorg corrected)',
        message: 'Invoice #101 settlement was rolled back and disputed in revised ledger.',
        href: '/freelancer',
      });
    });

    // Should NOT duplicate the notification row
    expect(result.current.notifications).toHaveLength(1);
    const updated = result.current.notifications[0];
    expect(updated.id).toBe('invoice-101');
    expect(updated.type).toBe('disputed');
    expect(updated.title).toBe('Invoice #101 disputed (reorg corrected)');
    // User is alerted: read is reset to false, unreadCount increments to 1
    expect(updated.read).toBe(false);
    expect(result.current.unreadCount).toBe(1);
  });

  it('allows retracting invalidated notifications via removeNotification after ledger reorg', () => {
    const { result } = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    act(() => {
      result.current.addNotification({
        id: 'orphaned-tx-55',
        category: 'lp',
        type: 'funded',
        title: 'Position funded',
        message: 'Position was funded in orphaned block.',
        href: '/dashboard',
      });
      result.current.addNotification({
        id: 'valid-tx-56',
        category: 'lp',
        type: 'funded',
        title: 'Position funded',
        message: 'Valid position.',
        href: '/dashboard',
      });
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(2);

    // Reorg drops orphaned transaction 55
    act(() => {
      result.current.removeNotification('orphaned-tx-55');
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].id).toBe('valid-tx-56');
    expect(result.current.unreadCount).toBe(1);

    // Verify storage persistence without orphaned notification
    const stored = JSON.parse(localStorage.getItem(notificationsKey) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('valid-tx-56');

    // Removing non-existent ID is safe no-op
    act(() => {
      result.current.removeNotification('non-existent-id');
    });
    expect(result.current.notifications).toHaveLength(1);
  });

  // ─── Wallet Reconnect and Unread Counts tests ──────────────────────────────

  it('handles wallet disconnect and reconnect cleanly without state leaks or duplicate accounting', () => {
    seedNotifications(['reconnect-1', 'reconnect-2']);
    localStorage.setItem(readKey, JSON.stringify({ 'reconnect-1': true }));

    const { result, rerender } = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);

    // Wallet disconnects
    act(() => {
      mockWalletAddress = null;
      rerender();
    });

    // Active state must be immediately cleared
    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);

    // Wallet reconnects with same address
    act(() => {
      mockWalletAddress = 'GTESTWALLET123';
      rerender();
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.isRead('reconnect-1')).toBe(true);
    expect(result.current.isRead('reconnect-2')).toBe(false);

    // Reconnect replaying existing events does not duplicate items or inflate unreadCount
    act(() => {
      result.current.addNotification({
        id: 'reconnect-1',
        category: 'invoice',
        type: 'funded',
        title: 'Notification reconnect-1',
        message: 'Invoice funded',
        href: '/dashboard',
      });
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
  });

  it('handles clearUnread and idempotent markAsRead calls accurately', () => {
    const { result } = renderHook(() => useNotification(), {
      wrapper: NotificationProvider,
    });

    act(() => {
      result.current.addNotification({
        id: 'u1',
        category: 'invoice',
        type: 'info',
        title: 'U1',
        message: 'Msg 1',
        href: '/',
      });
      result.current.addNotification({
        id: 'u2',
        category: 'invoice',
        type: 'info',
        title: 'U2',
        message: 'Msg 2',
        href: '/',
      });
    });

    expect(result.current.unreadCount).toBe(2);

    // Idempotent markAsRead on u1
    act(() => {
      result.current.markAsRead('u1');
      result.current.markAsRead('u1');
    });

    expect(result.current.unreadCount).toBe(1);

    // markAsRead on unknown ID is safe no-op
    act(() => {
      result.current.markAsRead('unknown-xyz');
    });
    expect(result.current.unreadCount).toBe(1);

    // clearUnread marks all remaining as read
    act(() => {
      result.current.clearUnread();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });
});
