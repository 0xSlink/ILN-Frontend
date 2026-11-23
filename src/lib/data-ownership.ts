/**
 * Authoritative data-ownership registry (#1141, #1269).
 *
 * Every financial metric rendered by the frontend maps to exactly one
 * authoritative source and one provenance class. Local fallbacks are never
 * authoritative: in production they must be `none` (honest unavailable state)
 * or explicitly labelled development-only stand-ins. `freshness` mirrors the
 * app's cache timings so reviewers can see how stale a value may be, and
 * `owner` names the incident owner when the source degrades.
 *
 * Provenance classes are deliberately limited to the categories a reviewer can
 * verify from the UI: RPC/Horizon/indexer reads, labelled estimates, and an
 * honest unavailable state. The registry is the single source of truth for the
 * caption rendered by `DataSourceCaption`.
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
  | 'wallet-transaction-status'
  | 'homepage-protocol-metrics'
  | 'invoice-state-distribution'
  | 'recent-protocol-activity'
  | 'wallet-referral-stats';

export type DataSourceKind = 'rpc' | 'horizon' | 'indexer' | 'estimate' | 'unavailable';

export const DATA_SOURCE_LABELS: Record<DataSourceKind, string> = {
  rpc: 'RPC',
  horizon: 'Horizon',
  indexer: 'Indexer',
  estimate: 'Estimate',
  unavailable: 'Unavailable',
};

export interface DataOwnership {
  metric: DataMetricKey;
  /** Authoritative source (contract method / indexer endpoint / RPC). */
  source: string;
  /** Verifiable provenance class surfaced in every financial chart caption. */
  provenance: DataSourceKind;
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
    provenance: 'rpc',
    fallback:
      'none in production — proposals list renders unavailable when the contract read fails',
    freshness: 'on-demand per mount (no cache)',
    owner: 'Governance contract team',
  },
  'voting-power': {
    metric: 'voting-power',
    source: 'ILN token contract `balance` via RPC simulation',
    provenance: 'rpc',
    fallback: 'none in production — voting power renders unavailable, never a hardcoded balance',
    freshness: 'per wallet connect / address change',
    owner: 'Token contract team',
  },
  'protocol-parameters': {
    metric: 'protocol-parameters',
    source: 'Governance contract parameter reads (fee rate, quorum, accepted tokens)',
    provenance: 'rpc',
    fallback: 'built-in deployment defaults, labelled as defaults (fee 0 on read failure)',
    freshness: 'per mount; parameter updates cached 5m (QUERY_TIMINGS.parameterUpdates)',
    owner: 'Governance contract team',
  },
  'funding-history': {
    metric: 'funding-history',
    source: 'Indexer `GET /v1/analytics/funding`',
    provenance: 'indexer',
    fallback: 'none in production — honest unavailable notice (dev mock only)',
    freshness: 'per time-range selection, no cross-range cache',
    owner: 'Indexer team',
  },
  'default-rate': {
    metric: 'default-rate',
    source: 'Indexer `GET /analytics/defaults`',
    provenance: 'indexer',
    fallback: 'none in production — honest unavailable notice (dev mock only)',
    freshness: 'per mount (12-month window)',
    owner: 'Indexer team',
  },
  'invoice-activity': {
    metric: 'invoice-activity',
    source: 'Indexer `GET /invoice/:id/events`',
    provenance: 'indexer',
    fallback: 'none in production — honest unavailable notice (dev mock only)',
    freshness: 'per invoice view',
    owner: 'Indexer team',
  },
  leaderboard: {
    metric: 'leaderboard',
    source: 'Indexer `GET /leaderboard` (server-side, authenticated when INDEXER_API_KEY is set)',
    provenance: 'indexer',
    fallback: 'empty + `unavailable: true` flag — never rendered as zero rows',
    freshness: 'per type/period selection, no-store',
    owner: 'Indexer team',
  },
  'contract-stats': {
    metric: 'contract-stats',
    source: 'Direct RPC reads: `getAllInvoices` + protocol contract events',
    provenance: 'rpc',
    fallback: 'none for volume; fee rate falls back to the labelled deployment default 0',
    freshness: 'stale 60s / gc 10m (QUERY_TIMINGS.stats)',
    owner: 'Smart-contract team',
  },
  'wallet-transaction-status': {
    metric: 'wallet-transaction-status',
    source: 'Stellar RPC `getTransaction` / `pollTransaction` (network truth)',
    provenance: 'rpc',
    fallback: 'none — the local pending store is a reminder, never a settlement verdict',
    freshness: 'real-time poll until settled, reconciled on reconnect + reload',
    owner: 'Wallet / RPC infrastructure',
  },
  'homepage-protocol-metrics': {
    metric: 'homepage-protocol-metrics',
    source: 'Direct RPC reads through `get_contract_stats` and `get_invoice_count`',
    provenance: 'rpc',
    fallback: 'none — each metric renders unavailable instead of a fabricated zero',
    freshness: 'stale 60s / gc 10m (QUERY_TIMINGS.stats); invoice count polls 30s',
    owner: 'Smart-contract team',
  },
  'invoice-state-distribution': {
    metric: 'invoice-state-distribution',
    source: 'Direct RPC reads: `getInvoiceCount` + `getAllInvoices` state counts',
    provenance: 'rpc',
    fallback: 'none — the chart renders unavailable rather than an empty or zero distribution',
    freshness: 'per mount (no cross-mount cache)',
    owner: 'Smart-contract team',
  },
  'recent-protocol-activity': {
    metric: 'recent-protocol-activity',
    source: 'Direct RPC reads: protocol contract events + `getAllInvoices`',
    provenance: 'rpc',
    fallback: 'none — an honest unavailable notice replaces the activity feed',
    freshness: 'stale 55s / poll 60s (useRecentProtocolFeed)',
    owner: 'Smart-contract team',
  },
  'wallet-referral-stats': {
    metric: 'wallet-referral-stats',
    source: 'Referral contract `get_referral_stats` via RPC simulation',
    provenance: 'rpc',
    fallback: 'none — unavailable labels replace zero counts, zero volume, and reward totals',
    freshness: 'stale 60s / gc 10m (QUERY_TIMINGS.stats); poll 60s',
    owner: 'Smart-contract team',
  },
};

/** Look up the ownership record for a metric. */
export function getDataOwnership(metric: DataMetricKey): DataOwnership {
  return DATA_OWNERSHIP[metric];
}

/** Human-readable provenance label for a metric or an explicit runtime state. */
export function getDataSourceLabel(kind: DataSourceKind): string {
  return DATA_SOURCE_LABELS[kind];
}

/**
 * Visible `Source • Provenance • Freshness` caption for metric surfaces.
 * `provenance` may be overridden at runtime when a surface has no current data
 * (Unavailable) or is showing a clearly labelled default (Estimate).
 */
export function formatDataSourceCaption(
  metric: DataMetricKey,
  options: { provenance?: DataSourceKind } = {}
): string {
  const entry = DATA_OWNERSHIP[metric];
  const provenance = options.provenance ?? entry.provenance;
  return `Source: ${entry.source} • Provenance: ${getDataSourceLabel(
    provenance
  )} • Freshness: ${entry.freshness}`;
}
