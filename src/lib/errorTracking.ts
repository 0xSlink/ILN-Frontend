'use client';

/**
 * Error-tracking integration extension (#794).
 *
 * Extends the base error-tracking from Issue 54 to capture browser, OS, and
 * detected wallet version/type as structured context on every error.
 *
 * Design:
 * - Provider-agnostic: if Sentry is present (`window.Sentry` or
 *   `NEXT_PUBLIC_SENTRY_DSN`), events are forwarded with tags/context.
 *   Otherwise events are emitted as `iln:error` CustomEvents and console-logged,
 *   so tests and dashboards without Sentry still capture context.
 * - `getCompatibilityContext()` from `compatibility.ts` supplies the dimensions
 *   that power the breakdown dashboard (browser / OS / wallet-version).
 */

import {
  getCompatibilityContext,
  getCompatibilityTags,
  type CompatibilityContext,
} from './compatibility';
import { trackEvent } from './analytics';

export const ERROR_EVENT = 'iln:error';

export interface ErrorReport {
  error: Error;
  context: CompatibilityContext;
  tags: Record<string, string>;
  extra?: Record<string, unknown>;
  timestamp: string;
}

type SentryLike = {
  captureException: (err: unknown, ctx?: unknown) => void;
  captureMessage?: (msg: string, ctx?: unknown) => void;
  setContext?: (key: string, ctx: unknown) => void;
  setTag?: (key: string, value: string) => void;
};

function getSentry(): SentryLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const sentry = (w.Sentry as SentryLike) ?? (w.__SENTRY__ as SentryLike) ?? null;
  if (sentry && typeof sentry.captureException === 'function') return sentry;
  return null;
}

function hasSentryDsn(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export function buildErrorReport(
  error: Error,
  extra?: Record<string, unknown>
): ErrorReport {
  const context = getCompatibilityContext();
  const tags = getCompatibilityTags(context);
  return {
    error,
    context,
    tags,
    extra,
    timestamp: new Date().toISOString(),
  };
}

export function reportError(
  error: Error,
  extra?: Record<string, unknown>
): ErrorReport {
  const report = buildErrorReport(error, extra);

  // 1. Forward to Sentry if configured.
  const sentry = getSentry();
  if (sentry || hasSentryDsn()) {
    try {
      const payload = {
        tags: report.tags,
        contexts: {
          browser: report.context.browser,
          os: report.context.os,
          wallet: report.context.wallet,
          compatibility: report.context,
        },
        extra: { ...extra, viewport: report.context.viewport, language: report.context.language },
      };
      if (sentry) {
        sentry.captureException(error, payload);
      } else {
        // Sentry SDK not yet loaded but DSN configured — log so init can pick it up.
        // The `iln:error` event below will also be ingested once Sentry is ready.
        console.error('[errorTracking] Sentry DSN configured but SDK not loaded', payload);
      }
    } catch {
      // never throw from error reporting
    }
  }

  // 2. Emit DOM event so any sink (tests, custom dashboard, analytics) can observe.
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent<ErrorReport>(ERROR_EVENT, { detail: report })
      );
    } catch {
      // ignore
    }
    // Also mirror into analytics bridge for lightweight dashboarding without Sentry.
    try {
      trackEvent('error_captured', {
        message: error.message,
        stack: error.stack?.slice(0, 500),
        ...report.tags,
        ...extra,
      });
    } catch {
      // ignore
    }
  }

  // 3. Always log for local debugging.
  console.error(error, { tags: report.tags, extra });

  return report;
}

export function reportMessage(
  message: string,
  extra?: Record<string, unknown>
): ErrorReport {
  return reportError(new Error(message), extra);
}

/**
 * Install global handlers that ensure every uncaught error / unhandled
 * rejection is enriched with compatibility context before it reaches the
 * tracking backend.
 *
 * Call once at app startup (e.g. in `app/Providers.tsx` or `instrumentation-client.ts`).
 * Safe to call multiple times — handlers are idempotent.
 */
let installed = false;

export function installGlobalErrorTracking(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    const err = event.error instanceof Error ? event.error : new Error(event.message || 'Unknown error');
    reportError(err, { source: 'window.onerror', filename: event.filename, lineno: event.lineno });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : new Error(String(reason ?? 'Unhandled rejection'));
    reportError(err, { source: 'unhandledrejection' });
  });
}

/**
 * Attach compatibility context to an existing Sentry scope (when the SDK is
 * initialized with `Sentry.init`). Returns the context for convenience.
 */
export function attachCompatibilityContextToSentry(): CompatibilityContext {
  const ctx = getCompatibilityContext();
  const tags = getCompatibilityTags(ctx);
  const sentry = getSentry();
  if (sentry) {
    try {
      for (const [k, v] of Object.entries(tags)) {
        sentry.setTag?.(k, v);
      }
      sentry.setContext?.('compatibility', ctx);
      sentry.setContext?.('browser', ctx.browser);
      sentry.setContext?.('os', ctx.os);
      sentry.setContext?.('wallet', ctx.wallet);
    } catch {
      // ignore
    }
  }
  return ctx;
}
