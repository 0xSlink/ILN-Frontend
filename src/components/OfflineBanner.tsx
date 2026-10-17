'use client';

import { useEffect, useRef, useState } from 'react';
// eslint-disable-next-line no-restricted-imports -- App reconnect banner query client exception
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff, X, ShieldCheck } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

const DISMISS_ANIMATION_MS = 250;

type SwStatus = 'unknown' | 'active' | 'inactive';

async function triggerBackgroundSync(reg: ServiceWorkerRegistration): Promise<void> {
  try {
    // SyncManager is available in supporting browsers
    if ('sync' in reg) {
      await (
        reg as ServiceWorkerRegistration & {
          sync: { register(tag: string): Promise<void> };
        }
      ).sync.register('sync-queued-requests');
    }
  } catch {
    // Background sync not supported or not permitted — no-op
  }
}

export default function OfflineBanner() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [swStatus, setSwStatus] = useState<SwStatus>('unknown');
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect service worker registration status
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSwStatus('inactive');
      return;
    }

    navigator.serviceWorker.ready
      .then(() => setSwStatus('active'))
      .catch(() => setSwStatus('inactive'));

    // Also listen for SW state changes
    const handleControllerChange = () => {
      if (navigator.serviceWorker.controller) {
        setSwStatus('active');
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  useEffect(() => {
    const updateConnectionState = () => {
      setIsVisible(!navigator.onLine);
    };

    updateConnectionState();

    const handleOnline = async () => {
      setIsExiting(true);

      // Resume React Query paused mutations and refetch active queries
      queryClient.resumePausedMutations();
      void queryClient.refetchQueries({ type: 'active' });

      // Trigger service worker background sync when available
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await triggerBackgroundSync(reg);
          // Notify SW to sync any queued state
          reg.active?.postMessage({ type: 'SYNC_ON_RECONNECT' });
        } catch {
          // SW may not be ready — React Query sync above is sufficient
        }
      }

      addToast({
        type: 'success',
        title: 'Back Online',
        message: 'Connection restored. Syncing queued requests now.',
      });

      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        setIsVisible(false);
        setIsExiting(false);
      }, DISMISS_ANIMATION_MS);
    };

    const handleOffline = () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      setIsVisible(true);
      setIsExiting(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [addToast, queryClient]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed left-0 right-0 top-0 z-50 bg-amber-500/90 backdrop-blur-sm transition-all duration-300 ${
        isExiting ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
        <div className="flex items-center gap-3 text-amber-900">
          <WifiOff className="h-4 w-4 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">
              You&apos;re offline. Some features may not be available.
            </span>
            {swStatus === 'active' && (
              <span className="flex items-center gap-1 text-xs text-amber-800">
                <ShieldCheck className="h-3 w-3" />
                Offline cache active — cached invoices and portfolio are available.
              </span>
            )}
            {swStatus === 'inactive' && (
              <span className="text-xs text-amber-800">
                No offline cache — connect to the internet to use the app.
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            setIsExiting(true);
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = setTimeout(() => setIsVisible(false), DISMISS_ANIMATION_MS);
          }}
          className="rounded p-1 text-amber-900 transition-colors hover:bg-amber-600/20"
          aria-label="Dismiss offline banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
