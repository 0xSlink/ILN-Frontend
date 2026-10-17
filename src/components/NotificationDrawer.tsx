'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';
import { useVisibleWindow } from '@/hooks/useVisibleWindow';
import {
  NOTIFICATIONS_PAGE_SIZE,
  formatTimeAgo,
  getNotificationAccentClass,
  getNotificationIcon,
  sortNotificationsNewestFirst,
} from '@/utils/notificationHelpers';

type Props = {
  onClose: () => void;
};

export default function NotificationDrawer({ onClose }: Props) {
  const { notifications, markAsRead, markAllAsRead } = useNotification();

  const orderedNotifications = useMemo(
    () => sortNotificationsNewestFirst(notifications),
    [notifications]
  );
  // Only a bounded window of rows is mounted so a high-volume account (e.g. an
  // active LP with many invoice/governance events) never renders unbounded.
  const { hasMore, remaining, loadMore, visibleSlice } = useVisibleWindow(
    orderedNotifications,
    NOTIFICATIONS_PAGE_SIZE,
    [],
    'notification-drawer'
  );

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/30"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col border-l border-outline-variant/20 bg-surface-container-lowest shadow-2xl"
        aria-label="Notification centre"
      >
        <div className="flex items-center justify-between border-b border-outline-variant/15 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">Notifications</h2>
            <p className="text-sm text-on-surface-variant">On-chain activity for your wallet</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"
            aria-label="Close drawer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="border-b border-outline-variant/15 px-5 py-3">
          <button
            type="button"
            onClick={() => markAllAsRead()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Mark all as read
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {orderedNotifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface-variant/30 p-8 text-center text-on-surface-variant">
              No notifications yet.
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {visibleSlice(orderedNotifications).map((notification) => (
                  <li key={notification.id}>
                    <Link
                      href={notification.href}
                      onClick={() => {
                        markAsRead(notification.id);
                        onClose();
                      }}
                      className={`flex gap-3 rounded-2xl border p-4 transition ${
                        notification.read
                          ? 'border-outline-variant/15 bg-surface-variant/20 opacity-75'
                          : 'border-outline-variant/20 bg-surface-container-low hover:border-primary/30'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined mt-0.5 shrink-0 ${getNotificationAccentClass(
                          notification.type
                        )}`}
                        aria-hidden
                      >
                        {getNotificationIcon(notification.category, notification.type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold ${getNotificationAccentClass(
                            notification.type
                          )}`}
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
                  className="mt-3 w-full rounded-xl border border-outline-variant/30 px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high"
                >
                  Load more ({remaining} remaining)
                </button>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
