'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
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

/**
 * NotificationContext API interface.
 *
 * Provides operations for consuming, deduplicating, acknowledging, and retracting
 * protocol notification events across normal polling, wallet reconnects, cross-tab synchronization,
 * and ledger reorgs.
 */
export interface NotificationContextType {
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
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearUnread: () => void;
  isRead: (id: string) => boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Safely deserializes stored read state map from local storage.
 *
 * Assumptions:
 * - LocalStorage is partitioned per wallet address.
 * - Map maps notification ID to boolean read flag.
 *
 * Failure behavior:
 * - Returns empty record if window is undefined, key is absent, or parsing throws.
 */
function loadReadMap(key: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/**
 * Applies persisted read state to an array of notification items.
 *
 * Rules:
 * - Read state is monotonic: once read, it stays read unless a reorg explicitly updates it.
 * - Missing entries in readMap fall back to the notification item's own read property.
 */
function applyReadState(
  items: NotificationItem[],
  readMap: Record<string, boolean>
): NotificationItem[] {
  return items.map((item) => ({
    ...item,
    read: readMap[item.id] ?? item.read,
  }));
}

/**
 * Deduplicates notification items by stable ID, preserving first occurrence order.
 */
function deduplicateNotifications(items: NotificationItem[]): NotificationItem[] {
  const seen = new Set<string>();
  const deduped: NotificationItem[] = [];
  for (const item of items) {
    if (item && typeof item.id === 'string' && !seen.has(item.id)) {
      seen.add(item.id);
      deduped.push(item);
    }
  }
  return deduped;
}

/**
 * NotificationProvider
 *
 * Architecture and Protocol Correctness:
 * 1. Data Sources:
 *    - In-app notification poller (`NotificationEventPoller`, `useNotificationEvents`, `usePositionPolling`).
 *    - Indexer WebSocket stream & Horizon contract event logs.
 *    - Cross-tab `StorageEvent` synchronization.
 * 2. Authorization & Scoping:
 *    - Storage keys are strictly scoped to the active wallet address (`iln-notifications:<address>`
 *      and `iln-notification-read:<address>`).
 *    - On wallet disconnect (`address === null`), all in-memory notifications and read states are wiped.
 *    - On wallet reconnect, notifications and read state for that address are restored from storage.
 * 3. Idempotency & Duplicate Events:
 *    - When event replay or duplicate stream messages arrive with identical ID and content,
 *      `addNotification` performs a no-op: it does not bump `createdAt`, re-order the list,
 *      or alter read status.
 * 4. Chain Reorgs & Corrected Notifications:
 *    - When an event arrives with an existing ID but modified content (e.g. status transition
 *      corrected from settled to disputed due to a Soroban ledger reorg), the notification is updated
 *      with the new details and marked unread so the user is alerted to the reorg correction.
 *    - If a ledger reorg completely rollbacks/invalidates an event, `removeNotification(id)`
 *      purges the invalid entry and decrements `unreadCount` accordingly.
 * 5. Bounded Storage & Memory:
 *    - Notifications are capped at `MAX_NOTIFICATIONS` (50) on write and load, preventing unbounded memory growth.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const { settings } = useLPSettings();
  const [notifications, setNotificationsState] = useState<NotificationItem[]>([]);
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});

  const notificationsRef = useRef<NotificationItem[]>(notifications);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const storageKey = address ? notificationsStorageKey(address) : null;
  const readKey = address ? readStateStorageKey(address) : null;

  // Wallet connection / address change / reconnect lifecycle
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
        const validArray = Array.isArray(parsed) ? parsed : [];
        const deduped = deduplicateNotifications(validArray).slice(0, MAX_NOTIFICATIONS);
        setNotificationsState(applyReadState(deduped, storedReads));
      } else {
        setNotificationsState([]);
      }
    } catch {
      setNotificationsState([]);
      setReadMap({});
    }
  }, [storageKey, readKey]);

  // Cross-tab synchronization via storage events
  useEffect(() => {
    if (!readKey) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === readKey) {
        const storedReads = loadReadMap(readKey);
        setReadMap((prev) => ({ ...prev, ...storedReads }));
        setNotificationsState((prev) => applyReadState(prev, storedReads));
      } else if (storageKey && event.key === storageKey) {
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            const parsed = JSON.parse(stored) as NotificationItem[];
            const storedReads = loadReadMap(readKey);
            const deduped = deduplicateNotifications(Array.isArray(parsed) ? parsed : []).slice(
              0,
              MAX_NOTIFICATIONS
            );
            setNotificationsState(applyReadState(deduped, storedReads));
          } else {
            setNotificationsState([]);
          }
        } catch {
          // Keep current in-memory state on malformed external storage write
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [readKey, storageKey]);

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
        const deduped = deduplicateNotifications(resolved).slice(0, MAX_NOTIFICATIONS);
        const withRead = applyReadState(deduped, readMap);
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

      const prefs = settings.notificationPreferences;
      const categoryAllowed = prefs.categories[notification.category] ?? true;

      // Unconfigured or disabled in-app categories are dropped before processing
      if (!prefs.inAppEnabled || !categoryAllowed) {
        return {
          ...notification,
          id: stableId,
          createdAt: new Date().toISOString(),
          read: readMap[stableId] ?? false,
        };
      }

      const existing = notificationsRef.current.find((n) => n.id === stableId);
      if (existing) {
        // Check if this is an identical duplicate event (replay or poll repetition)
        const isIdentical =
          existing.category === notification.category &&
          existing.type === notification.type &&
          existing.title === notification.title &&
          existing.message === notification.message &&
          existing.href === notification.href;

        if (isIdentical) {
          // Duplicate event: preserve original createdAt, read state, and list position.
          return existing;
        }

        // Reorg-corrected notification: event ID exists but content has changed.
        // We update the item in place and alert user (mark unread if revised block altered status).
        const reorgCorrected: NotificationItem = {
          ...notification,
          id: stableId,
          createdAt: new Date().toISOString(),
          read: false, // Reorg corrections require user attention
        };

        setNotificationsState((prev) => {
          const updatedList = prev.map((item) => (item.id === stableId ? reorgCorrected : item));
          persistNotifications(updatedList);
          return updatedList;
        });

        return reorgCorrected;
      }

      // Fresh event
      const freshNotification: NotificationItem = {
        ...notification,
        id: stableId,
        createdAt: new Date().toISOString(),
        read: readMap[stableId] ?? false,
      };

      setNotificationsState((prev) => {
        const next = [freshNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
        persistNotifications(next);
        return next;
      });

      return freshNotification;
    },
    [readMap, persistNotifications, settings]
  );

  const removeNotification = useCallback(
    (id: string) => {
      setNotificationsState((prev) => {
        const next = prev.filter((n) => n.id !== id);
        if (next.length === prev.length) return prev;
        persistNotifications(next);
        return next;
      });
    },
    [persistNotifications]
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
        removeNotification,
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
