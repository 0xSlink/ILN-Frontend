import * as Sentry from '@sentry/nextjs';
import { scrubSentryBreadcrumb, scrubSentryEvent } from './src/lib/sentry-scrubbing';

export const sentryClientConfig: NonNullable<Parameters<typeof Sentry.init>[0]> = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',

  // Never auto-collect default PII (IP addresses, cookies, auth headers).
  sendDefaultPii: false,

  // Capture 100% of transactions in production for the signing path;
  // lower for general pages to control volume.
  tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'production' ? 0.2 : 1.0,

  // Upload source maps during build (handled by withSentryConfig in next.config.ts).
  // At runtime, source maps are NOT served publicly — they live only in Sentry storage.

  integrations: [
    Sentry.browserTracingIntegration(),
    // Forward CSP violation reports received at /api/csp-report as Sentry events,
    // feeding both error classes into a unified detection pipeline (Issue #24).
    Sentry.browserApiErrorsIntegration(),
  ],

  // Scrub wallet addresses, invoice identifiers, transaction payloads, secrets,
  // and PII before any event or breadcrumb leaves the browser (Issue #1355).
  beforeSend(event) {
    return scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
  },

  beforeBreadcrumb(breadcrumb) {
    return scrubSentryBreadcrumb(
      breadcrumb as unknown as Record<string, unknown>
    ) as unknown as typeof breadcrumb;
  },

  // Tag every event with the Vercel deployment URL for correlation with rollback logs.
  initialScope: {
    tags: {
      deployment_url: process.env.NEXT_PUBLIC_VERCEL_URL ?? 'local',
    },
  },

  // Suppress noisy third-party errors that don't affect ILN functionality.
  ignoreErrors: ['ResizeObserver loop limit exceeded', 'Non-Error promise rejection captured'],
};

Sentry.init(sentryClientConfig);
