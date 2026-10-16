'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useProtocolStatus } from '@/hooks/useProtocolStatus';

const DISMISSAL_KEY = 'iln-maintenance-banner-dismissed';
const maintenanceModeEnabled = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';

/**
 * Protocol-wide maintenance banner with two detection sources:
 *
 * 1. **Manual override** (env var `NEXT_PUBLIC_MAINTENANCE_MODE=true`): Always
 *    takes precedence — if the deploy-time flag is set the banner shows
 *    regardless of the on-chain status, covering edge cases the automatic
 *    detection might miss.
 *
 * 2. **Automatic detection** (contract `get_protocol_status()` view): Polled
 *    every 30 s; surfaces the banner when `paused: true` is returned, without
 *    requiring a manual frontend deploy.
 *
 * Dismissal is per browser session (sessionStorage) so the notice remains
 * visible across navigation while not haunting a user for the rest of the
 * session after they acknowledge it.
 */
export default function MaintenanceModeBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data: protocolStatus } = useProtocolStatus();

  useEffect(() => {
    if (window.sessionStorage.getItem(DISMISSAL_KEY) === 'true') {
      setDismissed(true);
    }
  }, []);

  const isPaused = maintenanceModeEnabled || protocolStatus?.paused === true;

  if (!isPaused || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-[70] border-b-2 border-amber-700/40 bg-amber-100 text-amber-950 shadow-lg dark:bg-amber-950 dark:text-amber-50"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Protocol maintenance in progress</p>
          <p className="mt-1 text-amber-900 dark:text-amber-100">
            Some ILN services may be unavailable or delayed while we investigate and restore the
            protocol. Please do not submit or sign new transactions until this notice is removed.
          </p>
          {protocolStatus?.reason ? (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
              Reason: {protocolStatus.reason}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            window.sessionStorage.setItem(DISMISSAL_KEY, 'true');
            setDismissed(true);
          }}
          className="rounded p-1 transition-colors hover:bg-amber-900/10 dark:hover:bg-amber-50/10"
          aria-label="Dismiss maintenance notice for this session"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
