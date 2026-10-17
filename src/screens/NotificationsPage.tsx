'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';
import { useWallet } from '@/context/WalletContext';
import { useVisibleWindow } from '@/hooks/useVisibleWindow';
import {
  NOTIFICATIONS_PAGE_SIZE,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  countNotificationsByCategory,
  filterNotificationsByCategory,
  formatTimeAgo,
  getNotificationAccentClass,
  getNotificationIcon,
  sortNotificationsNewestFirst,
  type NotificationCategoryFilter,
} from '@/utils/notificationHelpers';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

function filterLabel(filter: NotificationCategoryFilter): string {
  return filter === 'all' ? 'All' : NOTIFICATION_CATEGORY_LABELS[filter];
}

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const { isConnected } = useWallet();
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategoryFilter>('all');

  const orderedNotifications = useMemo(
    () => sortNotificationsNewestFirst(notifications),
    [notifications]
  );
  const categoryCounts = useMemo(
    () => countNotificationsByCategory(orderedNotifications),
    [orderedNotifications]
  );
  const filteredNotifications = useMemo(
    () => filterNotificationsByCategory(orderedNotifications, categoryFilter),
    [orderedNotifications, categoryFilter]
  );
  // Only a bounded window of rows is mounted so a high-volume account (e.g. an
  // active LP with many invoice/governance events) never renders unbounded.
  // Changing the category filter starts the window from the top again.
  const { hasMore, remaining, loadMore, visibleSlice } = useVisibleWindow(
    filteredNotifications,
    NOTIFICATIONS_PAGE_SIZE,
    [categoryFilter],
    'notifications-page'
  );
  const filterOptions: NotificationCategoryFilter[] = ['all', ...NOTIFICATION_CATEGORIES];

  if (!isConnected) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-surface-container flex flex-col items-center justify-center px-4 pt-20">
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant">
              notifications_off
            </span>
            <h1 className="mt-4 text-2xl font-headline">Connect your wallet</h1>
            <p className="mt-2 text-on-surface-variant">
              Connect your wallet to view notifications.
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface-container pt-24 pb-12">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-8 flex flex-col gap-1">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Activity</p>
            <div className="flex items-center justify-between">
              <h1 className="font-headline text-3xl sm:text-4xl">Notifications</h1>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          {orderedNotifications.length > 0 && (
            <div
              role="group"
              aria-label="Filter notifications by category"
              className="mb-6 flex flex-wrap gap-2"
            >
              {filterOptions.map((option) => {
                const { total, unread } = categoryCounts[option];
                const selected = categoryFilter === option;
                const label = filterLabel(option);
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${label} (${total}${unread > 0 ? `, ${unread} unread` : ''})`}
                    onClick={() => setCategoryFilter(option)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                      selected
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {label}
                    <span className="ml-1.5 opacity-80">{total}</span>
                  </button>
                );
              })}
            </div>
          )}

          {orderedNotifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface-variant/30 p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                notifications_none
              </span>
              <p className="mt-4 text-on-surface-variant">No notifications yet.</p>
              <p className="mt-1 text-sm text-on-surface-variant/70">
                On-chain activity for your wallet will appear here.
              </p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface-variant/30 p-12 text-center">
              <p className="text-on-surface-variant">
                No {filterLabel(categoryFilter).toLowerCase()} notifications.
              </p>
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className="mt-4 text-sm font-bold text-primary hover:underline"
              >
                Show all notifications
              </button>
            </div>
          ) : (
            <>
              <ul className="space-y-3">
                {visibleSlice(filteredNotifications).map((notification) => (
                  <li key={notification.id}>
                    <Link
                      href={notification.href}
                      onClick={() => markAsRead(notification.id)}
                      className={`flex gap-4 rounded-2xl border p-5 transition ${
                        notification.read
                          ? 'border-outline-variant/15 bg-surface-variant/20 opacity-75'
                          : 'border-outline-variant/20 bg-surface-container-lowest hover:border-primary/30'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined mt-0.5 shrink-0 ${getNotificationAccentClass(notification.type)}`}
                        aria-hidden
                      >
                        {getNotificationIcon(notification.category, notification.type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold ${getNotificationAccentClass(notification.type)}`}
                        >
                          {notification.title}
                        </p>
                        <p className="mt-1 text-sm text-on-surface-variant line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="mt-2 text-xs text-on-surface-variant/80">
                          {formatTimeAgo(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.read && (
                        <span
                          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  className="mt-6 w-full rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high"
                >
                  Load more ({remaining} remaining)
                </button>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
