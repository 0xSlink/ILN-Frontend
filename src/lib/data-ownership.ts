/**
 * Authoritative data-ownership registry (#1141).
 *
 * Every financial metric rendered by the frontend maps to exactly one
 * authoritative source. Local fallbacks are never authoritative: in production
 * they must be `none` (honest unavailable state) or explicitly labelled
 * development-only stand-ins. `freshness` mirrors the app's cache timings so
 * reviewers can see how stale a value may be, and `owner` names the incident
 * owner when the source degrades.
 *
 * Rule enforced by `src/lib/__tests__/data-ownership.test.ts`:
 * no production fallback may fabricate a financial value.
 */

export type DataMetricKey =
  | 'governance-proposals'
  | 'voting-power'
  | 'protocol-parameters'
  | 'funding-history'
  | 'default-rate'
  | 'invoice-activity'
  | 'leaderboard'
  | 'contract-stats'
  | 'wallet-transaction-status';

export interface DataOwnership {
  metric: DataMetricKey;
  /** Authoritative source (contract method / indexer endpoint / RPC). */
  source: string;
  /**
   * What renders when the source is unreachable in production.
   * Must never be a fabricated financial value.
   */
  fallback: string;
  /** How fresh the value can be (mirrors QUERY_TIMINGS / fetch policy). */
  freshness: string;
  /** Incident owner when this source degrades. */
  owner: string;
}

export const DATA_OWNERSHIP: Record<DataMetricKey, DataOwnership> = {
  'governance-proposals': {
    metric: 'governance-proposals',
    source: 'Soroban governance contract `list_proposals` via RPC simulation',
    fallback:
      'none in production — proposals list renders unavailable when the contract read fails',
    freshness: 'on-demand per mount (no cache)',
    owner: 'Governance contract team',
  },
  'voting-power': {
    metric: 'voting-power',
    source: 'ILN token contract `balance` via RPC simulation',
    fallback: 'none in production — voting power renders unavailable, never a hardcoded balance',
    freshness: 'per wallet connect / address change',
    owner: 'Token contract team',
  },
  'protocol-parameters': {
    metric: 'protocol-parameters',
    source: 'Governance contract parameter reads (fee rate, quorum, accepted tokens)',
    fallback: 'built-in deployment defaults, labelled as defaults (fee 0 on read failure)',
    freshness: 'per mount; parameter updates cached 5m (QUERY_TIMINGS.parameterUpdates)',
    owner: 'Governance contract team',
  },
  'funding-history': {
    metric: 'funding-history',
    source: 'Indexer `GET /v1/analytics/funding`',
    fallback: 'none in production — honest unavailable notice (dev mock only)',
    freshness: 'per time-range selection, no cross-range cache',
    owner: 'Indexer team',
  },
  'default-rate': {
    metric: 'default-rate',
    source: 'Indexer `GET /analytics/defaults`',
    fallback: 'none in production — honest unavailable notice (dev mock only)',
    freshness: 'per mount (12-month window)',
    owner: 'Indexer team',
  },
  'invoice-activity': {
    metric: 'invoice-activity',
    source: 'Indexer `GET /invoice/:id/events`',
    fallback: 'none in production — honest unavailable notice (dev mock only)',
    freshness: 'per invoice view',
    owner: 'Indexer team',
  },
  leaderboard: {
    metric: 'leaderboard',
    source: 'Indexer `GET /leaderboard` (server-side, authenticated when INDEXER_API_KEY is set)',
    fallback: 'empty + `unavailable: true` flag — never rendered as zero rows',
    freshness: 'per type/period selection, no-store',
    owner: 'Indexer team',
  },
  'contract-stats': {
    metric: 'contract-stats',
    source: 'Direct RPC reads: `getAllInvoices` + protocol contract events',
    fallback: 'none for volume; fee rate falls back to the labelled deployment default 0',
    freshness: 'stale 60s / gc 10m (QUERY_TIMINGS.stats)',
    owner: 'Smart-contract team',
  },
  'wallet-transaction-status': {
    metric: 'wallet-transaction-status',
    source: 'Stellar RPC `getTransaction` / `pollTransaction` (network truth)',
    fallback: 'none — the local pending store is a reminder, never a settlement verdict',
    freshness: 'real-time poll until settled, reconciled on reconnect + reload',
    owner: 'Wallet / RPC infrastructure',
  },
};

/** Look up the ownership record for a metric. */
export function getDataOwnership(metric: DataMetricKey): DataOwnership {
  return DATA_OWNERSHIP[metric];
}

/** One-line `Source • Freshness` caption for metric surfaces. */
export function formatDataSourceCaption(metric: DataMetricKey): string {
  const entry = DATA_OWNERSHIP[metric];
  return `Source: ${entry.source} • Freshness: ${entry.freshness}`;
}
