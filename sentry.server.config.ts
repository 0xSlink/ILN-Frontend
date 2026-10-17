import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',

  tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'production' ? 0.2 : 1.0,

  // Any error on the transaction-signing API routes is treated as P1 —
  // alert rules in Sentry are configured to page immediately for these paths.
  // See docs/sentry-integration.md for the full alert configuration.
});
