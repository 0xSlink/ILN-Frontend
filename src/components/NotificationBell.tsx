'use client';

import { useEffect, useState, useRef } from 'react';
import { useWallet } from '@/context/WalletContext';
import { useNotification, type NotificationItem } from '@/context/NotificationContext';
import { MAX_NOTIFICATIONS } from '@/utils/notificationHelpers';
import NotificationDrawer from './NotificationDrawer';

interface ExternalNotification {
  id: string;
  category?: NotificationItem['category'];
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
    const category =
      notification.category ?? (notification.type === 'proposal' ? 'governance' : 'invoice');
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
      const res = await fetch(`/api/notifications/${address}`);
      if (!active || !res.ok) return;

      const data = (await res.json()) as ExternalNotification[];
      setNotifications((current) => mergeNotifications(current, data, isRead));
    };

    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [address, isRead, setNotifications]);

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
        aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        className="relative rounded-full p-2 hover:bg-surface-variant transition-colors"
      >
        <span className="material-symbols-outlined text-on-surface-variant">notifications</span>

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
