/**
 * Production boundary for mock-backed governance behavior (#1320).
 *
 * Mock data and stubbed writes are available only in `development` and `test`.
 * Every other value, including an unset `NODE_ENV`, fails closed. Next.js inlines
 * `process.env.NODE_ENV`, so `next build` output always evaluates as production,
 * including testnet and preview deployments built that way.
 */
export function governanceMocksAllowed(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}
