'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useMemo,
} from 'react';
import { useWallet } from '@/context/WalletContext';
import { useLPSettings } from '@/hooks/useLPSettings';
import {
  MAX_NOTIFICATIONS,
  notificationsStorageKey,
  readStateStorageKey,
} from '@/utils/notificationHelpers';

/**
 * Feed categories the /notifications page can filter by. `admin` covers
 * protocol-level admin actions surfaced to users (pauses, signer rotations,
 * parameter updates); the admin audit log itself is Sentry-only and never
 * reaches this inbox. See docs/notifications-service.md.
 */
export type NotificationCategory = 'invoice' | 'lp' | 'governance' | 'reputation' | 'admin';

export type NotificationType =
  | 'funded'
  | 'settled'
  | 'expired'
  | 'disputed'
  | 'info'
  | 'warning'
  | 'proposal'
  | 'reputation';

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  read: boolean;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  setNotifications: (
    notifications: NotificationItem[] | ((previous: NotificationItem[]) => NotificationItem[])
  ) => void;
  addNotification: (
    notification: Omit<NotificationItem, 'createdAt' | 'read'> & {
      id?: string;
    }
  ) => NotificationItem;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearUnread: () => void;
  isRead: (id: string) => boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function loadReadMap(key: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function applyReadState(
  items: NotificationItem[],
  readMap: Record<string, boolean>
): NotificationItem[] {
  return items.map((item) => ({
    ...item,
    read: readMap[item.id] ?? item.read,
  }));
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const { settings } = useLPSettings();
  const [notifications, setNotificationsState] = useState<NotificationItem[]>([]);
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});

  const storageKey = address ? notificationsStorageKey(address) : null;
  const readKey = address ? readStateStorageKey(address) : null;

  useEffect(() => {
    if (!storageKey || !readKey) {
      setNotificationsState([]);
      setReadMap({});
      return;
    }

    try {
      const storedReads = loadReadMap(readKey);
      setReadMap(storedReads);

      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as NotificationItem[];
        // Writes are capped, but a stored list from an older build or another
        // writer may not be; cap on load too so the in-memory list stays bounded.
        const bounded = Array.isArray(parsed) ? parsed.slice(0, MAX_NOTIFICATIONS) : [];
        setNotificationsState(applyReadState(bounded, storedReads));
      } else {
        setNotificationsState([]);
      }
    } catch {
      setNotificationsState([]);
      setReadMap({});
    }
  }, [storageKey, readKey]);

  // Another tab on the same wallet marking notifications read must update this
  // tab's list and unread count too; `storage` events only fire in other tabs.
  useEffect(() => {
    if (!readKey) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== readKey) return;
      const storedReads = loadReadMap(readKey);
      setReadMap((prev) => ({ ...prev, ...storedReads }));
      setNotificationsState((prev) => applyReadState(prev, storedReads));
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [readKey]);

  // Read state only ever moves from unread to read (there is no "mark unread"),
  // so merging with the persisted map is a safe union. It stops a tab holding a
  // stale in-memory map from erasing reads another tab already saved.
  const persistReadMap = useCallback(
    (next: Record<string, boolean>) => {
      if (!readKey) return next;
      const merged = { ...loadReadMap(readKey), ...next };
      localStorage.setItem(readKey, JSON.stringify(merged));
      return merged;
    },
    [readKey]
  );

  const persistNotifications = useCallback(
    (items: NotificationItem[]) => {
      if (!storageKey) return;
      localStorage.setItem(storageKey, JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
    },
    [storageKey]
  );

  const setNotifications = useCallback(
    (items: NotificationItem[] | ((previous: NotificationItem[]) => NotificationItem[])) => {
      setNotificationsState((previous) => {
        const resolved = typeof items === 'function' ? items(previous) : items;
        const withRead = applyReadState(resolved.slice(0, MAX_NOTIFICATIONS), readMap);
        persistNotifications(withRead);
        return withRead;
      });
    },
    [readMap, persistNotifications]
  );

  const addNotification = useCallback(
    (
      notification: Omit<NotificationItem, 'createdAt' | 'read'> & {
        id?: string;
      }
    ) => {
      const stableId =
        notification.id ??
        `${notification.category}-${notification.type}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;

      const newNotification: NotificationItem = {
        ...notification,
        id: stableId,
        createdAt: new Date().toISOString(),
        read: readMap[stableId] ?? false,
      };

      const prefs = settings.notificationPreferences;
      const categoryAllowed = prefs.categories[notification.category] ?? true;

      if (!prefs.inAppEnabled || !categoryAllowed) {
        return newNotification;
      }

      setNotificationsState((prev) => {
        const withoutDuplicate = prev.filter((n) => n.id !== stableId);
        const next = [newNotification, ...withoutDuplicate].slice(0, MAX_NOTIFICATIONS);
        persistNotifications(next);
        return next;
      });

      return newNotification;
    },
    [readMap, persistNotifications, settings]
  );

  const markAsRead = useCallback(
    (id: string) => {
      const merged = persistReadMap({ [id]: true });
      setReadMap((prev) => ({ ...prev, ...merged }));
      setNotificationsState((prev) => {
        const next = applyReadState(prev, merged);
        persistNotifications(next);
        return next;
      });
    },
    [persistNotifications, persistReadMap]
  );

  const markAllAsRead = useCallback(() => {
    setNotificationsState((prev) => {
      const nextRead: Record<string, boolean> = { ...readMap };
      prev.forEach((notification) => {
        nextRead[notification.id] = true;
      });
      setReadMap(persistReadMap(nextRead));

      const next = prev.map((notification) => ({
        ...notification,
        read: true,
      }));
      persistNotifications(next);
      return next;
    });
  }, [readMap, persistNotifications, persistReadMap]);

  const clearUnread = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const isRead = useCallback((id: string) => readMap[id] === true, [readMap]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        setNotifications,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearUnread,
        isRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
