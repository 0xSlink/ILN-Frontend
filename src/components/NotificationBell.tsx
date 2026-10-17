'use client';

import { useEffect, useState, useRef } from 'react';
import { useWallet } from '@/context/WalletContext';
import { useNotification, type NotificationItem } from '@/context/NotificationContext';
import { MAX_NOTIFICATIONS, resolveNotificationCategory } from '@/utils/notificationHelpers';
import NotificationDrawer from './NotificationDrawer';

interface ExternalNotification {
  id: string;
  category?: string;
  type: string;
  title: string;
  message: string;
  href?: string;
  createdAt: string;
  read: boolean;
}

function mergeNotifications(
  existing: NotificationItem[],
  incoming: ExternalNotification[],
  isRead: (id: string) => boolean
): NotificationItem[] {
  const map = new Map(existing.map((notification) => [notification.id, notification]));

  incoming.forEach((notification) => {
    const category = resolveNotificationCategory(notification.category, notification.type);
    const href = notification.href ?? '/dashboard';
    map.set(notification.id, {
      id: notification.id,
      category,
      type: notification.type as NotificationItem['type'],
      title: notification.title,
      message: notification.message,
      href,
      createdAt: notification.createdAt,
      read: isRead(notification.id) || notification.read,
    });
  });

  return Array.from(map.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_NOTIFICATIONS);
}

export default function NotificationBell() {
  const { address, isConnected } = useWallet();
  const { setNotifications, unreadCount, isRead, markAllAsRead } = useNotification();
  const [open, setOpen] = useState(false);
  // Track previous unread count to detect new notifications for pulse
  const prevUnreadRef = useRef(unreadCount);
  const [isPulsing, setIsPulsing] = useState(false);

  const [announcement, setAnnouncement] = useState('');
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  // The poll reads the latest read-state callbacks through refs. Depending on
  // them directly restarted polling, firing an extra request at the
  // notifications service, every time a notification was marked read, and let
  // an in-flight poll apply a stale `isRead` that flipped it back to unread.
  const isReadRef = useRef(isRead);
  const setNotificationsRef = useRef(setNotifications);
  useEffect(() => {
    isReadRef.current = isRead;
    setNotificationsRef.current = setNotifications;
  }, [isRead, setNotifications]);

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setIsPulsing(true);

      // Announce new notifications to screen readers
      const newCount = unreadCount - prevUnreadRef.current;
      setAnnouncement(`${newCount} new notification${newCount > 1 ? 's' : ''}`);

      // Clear visual pulse after 2 seconds
      const pulseTimer = setTimeout(() => setIsPulsing(false), 2000);

      // Clear announcement after screen readers have time to read it
      const announceTimer = setTimeout(() => setAnnouncement(''), 3000);

      prevUnreadRef.current = unreadCount;
      return () => {
        clearTimeout(pulseTimer);
        clearTimeout(announceTimer);
      };
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (!address) return;

    let active = true;

    const fetchNotifications = async () => {
      // eslint-disable-next-line no-restricted-globals, no-restricted-syntax -- Legacy inline exception pending query hook migration
      const res = await fetch(`/api/notifications/${address}`);
      if (!active || !res.ok) return;

      const data = (await res.json()) as ExternalNotification[];
      // A poll that resolves after the wallet changed belongs to the previous
      // wallet; merging it would mix its notifications into the new inbox.
      if (!active) return;
      setNotificationsRef.current((current) =>
        mergeNotifications(current, data, isReadRef.current)
      );
    };

    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [address]);

  const handleOpen = () => {
    setOpen(true);
    // Clear unread count when drawer opens
    if (unreadCount > 0) markAllAsRead();
  };

  if (!isConnected) return null;

  return (
    <div className="relative" data-tour="notifications-bell">
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}${
          serviceUnavailable ? '. Notifications service temporarily unavailable.' : ''
        }`}
        aria-expanded={open}
        title={
          serviceUnavailable
            ? 'Notifications service temporarily unavailable. Showing cached notifications.'
            : undefined
        }
        className="relative rounded-full p-2 hover:bg-surface-variant transition-colors"
      >
        <span className="material-symbols-outlined text-on-surface-variant">notifications</span>

        {serviceUnavailable && (
          <span
            data-testid="notification-service-unavailable"
            aria-hidden
            className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-surface"
          />
        )}

        {unreadCount > 0 && (
          <span
            aria-hidden
            className={`absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1.5 text-[10px] font-bold text-on-error ${
              isPulsing ? 'animate-pulse' : ''
            }`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Screen reader announcement for new notifications */}
      <div role="status" aria-live="polite" className="sr-only" aria-label="Notification updates">
        {announcement}
      </div>

      {open && <NotificationDrawer onClose={() => setOpen(false)} />}
    </div>
  );
}
