'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rocket } from 'lucide-react';

/** localStorage key holding whether the user has dismissed the mainnet launch banner. */
const STORAGE_KEY = 'iln:dismissed-mainnet-launch';

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

/**
 * Announces the mainnet launch with a one-time dismissible banner.
 *
 * - Shows a prominent announcement banner at the top of the app.
 * - Dismissible per user; dismissal persists in localStorage.
 * - Links to the mainnet launch notes documentation.
 * - Renders nothing after dismissal.
 *
 * This banner should be added to the root layout or a prominent location
 * during the mainnet cutover window, then removed after the launch period.
 */
export default function MainnetLaunchBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Read persisted dismissal after mount to avoid SSR/client hydration mismatch.
  useEffect(() => {
    setDismissed(readDismissed());
    setHydrated(true);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Storage may be unavailable (private mode / quota) — dismissal still
      // applies for this session via state.
    }
  };

  if (!hydrated || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] border-b border-blue-500/30 bg-blue-500/10 px-4 py-3 text-blue-700 backdrop-blur-sm dark:text-blue-300"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Rocket className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            ILN is now live on mainnet! Switch your wallet to the Stellar public network to get
            started.
          </p>
          <Link
            href="/docs/mainnet-launch-notes"
            className="mt-1 inline-flex min-h-[44px] items-center text-xs font-medium underline underline-offset-2 opacity-90 hover:opacity-100"
          >
            View launch notes
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-blue-500/15"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
