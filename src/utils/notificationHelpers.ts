import type {
  NotificationCategory,
  NotificationItem,
  NotificationType,
} from '@/context/NotificationContext';

export const MAX_NOTIFICATIONS = 50;

/** Every category the notification feed understands, in display order. */
export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  'invoice',
  'lp',
  'governance',
  'reputation',
  'admin',
];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  invoice: 'Invoices',
  lp: 'Liquidity',
  governance: 'Governance',
  reputation: 'Reputation',
  admin: 'Admin',
};

/** A /notifications feed filter: one category, or every category. */
export type NotificationCategoryFilter = NotificationCategory | 'all';

/** Notification types that only ever describe a protocol admin action. */
const ADMIN_NOTIFICATION_TYPES = new Set([
  'admin',
  'protocol_paused',
  'protocol_unpaused',
  'signer_rotation',
  'parameter_update',
  'token_approved',
  'token_removed',
]);

function isNotificationCategory(value: unknown): value is NotificationCategory {
  return (
    typeof value === 'string' && (NOTIFICATION_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * Resolve the feed category for a notification from the backend service. A
 * known `category` wins; a missing or unrecognised one is inferred from `type`
 * so admin and governance events never fall into the invoice bucket (and so
 * never escape their filter). Anything still unknown stays `invoice`, the
 * historical default.
 */
export function resolveNotificationCategory(
  category: unknown,
  type: string | undefined
): NotificationCategory {
  if (isNotificationCategory(category)) return category;
  if (type === 'proposal') return 'governance';
  if (type === 'reputation') return 'reputation';
  if (type && ADMIN_NOTIFICATION_TYPES.has(type)) return 'admin';
  return 'invoice';
}

export function filterNotificationsByCategory(
  items: NotificationItem[],
  filter: NotificationCategoryFilter
): NotificationItem[] {
  if (filter === 'all') return items;
  return items.filter((item) => item.category === filter);
}

/** Total and unread counts per category, plus an `all` bucket. */
export function countNotificationsByCategory(
  items: NotificationItem[]
): Record<NotificationCategoryFilter, { total: number; unread: number }> {
  const counts = Object.fromEntries(
    (['all', ...NOTIFICATION_CATEGORIES] as NotificationCategoryFilter[]).map((key) => [
      key,
      { total: 0, unread: 0 },
    ])
  ) as Record<NotificationCategoryFilter, { total: number; unread: number }>;

  items.forEach((item) => {
    const buckets = [counts.all, counts[item.category]].filter(Boolean);
    buckets.forEach((bucket) => {
      bucket.total += 1;
      if (!item.read) bucket.unread += 1;
    });
  });

  return counts;
}

/**
 * How many notification rows the page and drawer mount at once. The rest are
 * revealed via "Load more" so a high-volume account never renders an unbounded
 * list. See docs/load-testing.md.
 */
export const NOTIFICATIONS_PAGE_SIZE = 20;

export function sortNotificationsNewestFirst(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function notificationsStorageKey(walletAddress: string) {
  return `iln-notifications:${walletAddress}`;
}

export function readStateStorageKey(walletAddress: string) {
  return `iln-notification-read:${walletAddress}`;
}

export function formatTimeAgo(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  const seconds = Math.floor((Date.now() - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

export function getNotificationIcon(
  category: NotificationCategory,
  type: NotificationType
): string {
  if (category === 'governance') return 'how_to_vote';
  if (category === 'reputation') return 'military_tech';
  if (category === 'lp') return 'account_balance';
  if (category === 'admin') return 'admin_panel_settings';
  if (type === 'settled' || type === 'funded') return 'paid';
  if (type === 'expired') return 'schedule';
  if (type === 'disputed') return 'gavel';
  if (type === 'warning') return 'warning';
  return 'receipt_long';
}

export function getNotificationAccentClass(type: NotificationType): string {
  switch (type) {
    case 'funded':
    case 'settled':
      return 'text-green-600 dark:text-green-400';
    case 'expired':
      return 'text-red-600 dark:text-red-400';
    case 'disputed':
      return 'text-orange-600 dark:text-orange-400';
    case 'warning':
      return 'text-amber-600 dark:text-amber-400';
    default:
      return 'text-primary';
  }
}
