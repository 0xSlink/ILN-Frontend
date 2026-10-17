import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_NOTIFICATIONS,
  NOTIFICATIONS_PAGE_SIZE,
  notificationsStorageKey,
  readStateStorageKey,
  formatTimeAgo,
  getNotificationIcon,
  getNotificationAccentClass,
  sortNotificationsNewestFirst,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  resolveNotificationCategory,
  filterNotificationsByCategory,
  countNotificationsByCategory,
} from '../notificationHelpers';
import type { NotificationItem } from '@/context/NotificationContext';

describe('storage key helpers', () => {
  it('namespaces the notifications key by wallet address', () => {
    expect(notificationsStorageKey('GADDR')).toBe('iln-notifications:GADDR');
  });

  it('namespaces the read-state key by wallet address', () => {
    expect(readStateStorageKey('GADDR')).toBe('iln-notification-read:GADDR');
  });

  it('exposes a MAX_NOTIFICATIONS cap', () => {
    expect(MAX_NOTIFICATIONS).toBe(50);
  });

  it('renders notifications in pages smaller than the retention cap', () => {
    expect(NOTIFICATIONS_PAGE_SIZE).toBe(20);
    expect(NOTIFICATIONS_PAGE_SIZE).toBeLessThan(MAX_NOTIFICATIONS);
  });
});

describe('sortNotificationsNewestFirst', () => {
  const item = (id: string, createdAt: string): NotificationItem => ({
    id,
    category: 'invoice',
    type: 'info',
    title: id,
    message: id,
    href: '/',
    createdAt,
    read: false,
  });

  it('orders newest first without mutating the input', () => {
    const input = [
      item('old', '2026-01-01T00:00:00Z'),
      item('new', '2026-03-01T00:00:00Z'),
      item('mid', '2026-02-01T00:00:00Z'),
    ];
    const sorted = sortNotificationsNewestFirst(input);
    expect(sorted.map((n) => n.id)).toEqual(['new', 'mid', 'old']);
    expect(input.map((n) => n.id)).toEqual(['old', 'new', 'mid']);
  });
});

describe('formatTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows "just now" for under a minute', () => {
    expect(formatTimeAgo(new Date('2026-01-01T11:59:30Z').toISOString())).toBe('just now');
  });

  it('shows minutes for under an hour', () => {
    expect(formatTimeAgo(new Date('2026-01-01T11:45:00Z').toISOString())).toBe('15m ago');
  });

  it('shows hours for under a day', () => {
    expect(formatTimeAgo(new Date('2026-01-01T09:00:00Z').toISOString())).toBe('3h ago');
  });

  it('shows days for under a week', () => {
    expect(formatTimeAgo(new Date('2025-12-29T12:00:00Z').toISOString())).toBe('3d ago');
  });

  it('shows a formatted date for a week or more', () => {
    const iso = new Date('2025-12-01T12:00:00Z').toISOString();
    expect(formatTimeAgo(iso)).toBe(new Date(iso).toLocaleDateString());
  });
});

describe('getNotificationIcon', () => {
  it('prioritizes category-based icons', () => {
    expect(getNotificationIcon('governance', 'funded')).toBe('how_to_vote');
    expect(getNotificationIcon('reputation', 'funded')).toBe('military_tech');
    expect(getNotificationIcon('lp', 'funded')).toBe('account_balance');
  });

  it('falls back to type-based icons for invoice category', () => {
    expect(getNotificationIcon('invoice', 'funded')).toBe('paid');
    expect(getNotificationIcon('invoice', 'settled')).toBe('paid');
    expect(getNotificationIcon('invoice', 'expired')).toBe('schedule');
    expect(getNotificationIcon('invoice', 'disputed')).toBe('gavel');
    expect(getNotificationIcon('invoice', 'warning')).toBe('warning');
  });

  it('defaults to receipt_long for unmatched types', () => {
    expect(getNotificationIcon('invoice', 'submitted' as any)).toBe('receipt_long');
  });
});

describe('getNotificationAccentClass', () => {
  it('returns the funded/settled green class', () => {
    expect(getNotificationAccentClass('funded')).toContain('green');
    expect(getNotificationAccentClass('settled')).toContain('green');
  });

  it('returns the expired red class', () => {
    expect(getNotificationAccentClass('expired')).toContain('red');
  });

  it('returns the disputed orange class', () => {
    expect(getNotificationAccentClass('disputed')).toContain('orange');
  });

  it('returns the warning amber class', () => {
    expect(getNotificationAccentClass('warning')).toContain('amber');
  });

  it('returns the default primary class for other types', () => {
    expect(getNotificationAccentClass('submitted' as any)).toBe('text-primary');
  });
});

describe('notification categories', () => {
  function item(
    id: string,
    category: NotificationItem['category'],
    read = false
  ): NotificationItem {
    return {
      id,
      category,
      type: 'info',
      title: id,
      message: id,
      href: '/',
      createdAt: '2026-01-01T00:00:00.000Z',
      read,
    };
  }

  it('labels every category, including admin', () => {
    expect(NOTIFICATION_CATEGORIES).toEqual(['invoice', 'lp', 'governance', 'reputation', 'admin']);
    NOTIFICATION_CATEGORIES.forEach((category) =>
      expect(NOTIFICATION_CATEGORY_LABELS[category]).toBeTruthy()
    );
  });

  it('keeps a known backend category as-is', () => {
    expect(resolveNotificationCategory('admin', 'info')).toBe('admin');
    expect(resolveNotificationCategory('lp', 'proposal')).toBe('lp');
  });

  it('infers a missing or unknown category from the type', () => {
    expect(resolveNotificationCategory(undefined, 'proposal')).toBe('governance');
    expect(resolveNotificationCategory(undefined, 'reputation')).toBe('reputation');
    expect(resolveNotificationCategory('audit', 'signer_rotation')).toBe('admin');
    expect(resolveNotificationCategory(undefined, 'parameter_update')).toBe('admin');
    expect(resolveNotificationCategory(undefined, 'protocol_paused')).toBe('admin');
  });

  it('falls back to invoice when nothing identifies the category', () => {
    expect(resolveNotificationCategory(undefined, 'settled')).toBe('invoice');
    expect(resolveNotificationCategory('unknown', undefined)).toBe('invoice');
    expect(resolveNotificationCategory(42, 'info')).toBe('invoice');
  });

  it('filters by category and passes everything through for all', () => {
    const items = [item('a', 'invoice'), item('b', 'admin'), item('c', 'governance')];
    expect(filterNotificationsByCategory(items, 'all')).toBe(items);
    expect(filterNotificationsByCategory(items, 'admin').map((n) => n.id)).toEqual(['b']);
    expect(filterNotificationsByCategory(items, 'reputation')).toEqual([]);
  });

  it('counts totals and unread per category', () => {
    const counts = countNotificationsByCategory([
      item('a', 'invoice'),
      item('b', 'invoice', true),
      item('c', 'admin'),
    ]);
    expect(counts.all).toEqual({ total: 3, unread: 2 });
    expect(counts.invoice).toEqual({ total: 2, unread: 1 });
    expect(counts.admin).toEqual({ total: 1, unread: 1 });
    expect(counts.reputation).toEqual({ total: 0, unread: 0 });
  });

  it('still counts a legacy stored item with an unrecognised category under all', () => {
    const legacy = { ...item('x', 'invoice'), category: 'legacy' } as unknown as NotificationItem;
    expect(countNotificationsByCategory([legacy]).all).toEqual({ total: 1, unread: 1 });
  });

  it('uses the admin icon for admin notifications', () => {
    expect(getNotificationIcon('admin', 'info')).toBe('admin_panel_settings');
  });
});
