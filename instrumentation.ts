/**
 * Next.js instrumentation hook (server).
 *
 * Registers server-side error enrichment for #794. On the server there is no
 * browser/wallet context, but we still tag Node/OS so the dashboard has a
 * consistent schema for SSR failures.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamically import to avoid pulling client-only deps on the server.
    const { reportError } = await import('./src/lib/errorTracking');
    // Lightweight global handler for uncaught server errors.
    // Next.js already routes errors to `instrumentation` — this ensures any
    // unhandled rejection is enriched before logging.
    process.on('unhandledRejection', (reason: unknown) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      reportError(err, { source: 'server:unhandledRejection' });
    });
  }
}
