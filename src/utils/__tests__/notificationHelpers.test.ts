import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_NOTIFICATIONS,
  notificationsStorageKey,
  readStateStorageKey,
  formatTimeAgo,
  getNotificationIcon,
  getNotificationAccentClass,
} from '../notificationHelpers';

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
