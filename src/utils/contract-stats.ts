import { getAllInvoices, type Invoice } from './soroban';
import { fetchProtocolParameters } from '@/utils/governance';
import { TESTNET_USDC_TOKEN_ID, TESTNET_EURC_TOKEN_ID, TESTNET_XLM_TOKEN_ID } from '@/constants';
import { fetchProtocolContractEvents } from '@/lib/fetch-protocol-contract-events';
import type { ParsedContractEvent } from '@/lib/contract-events';
import { computeDisputeRateMetrics, type DisputeRateMetrics } from '@/utils/dispute-rate';
import type { MetricProvenance } from '@/utils/financial-metrics';
import { toWholeUnits } from '@/utils/financial-metrics';
import {
  DEFAULT_INDEXER_STALE_AFTER_MS,
  type IndexerFreshness,
} from '@/lib/indexer/freshness';

const FUNDED_STATUSES = new Set(['Funded', 'PartiallyFunded', 'Paid', 'Defaulted']);

export const TOKEN_COLORS: Record<string, string> = {
  USDC: 'var(--color-primary, #008080)',
  EURC: 'var(--color-secondary, #2e7d32)',
  XLM: 'var(--color-tertiary, #d32f2f)',
};

export interface TokenVolume {
  symbol: string;
  amount_raw: number;
  amount_usd: number;
  percentage: number;
  color: string;
}

export interface DailyVolumeBucket {
  date: string;
  label: string;
  volume_usd: number;
  usdc: number;
  eurc: number;
  xlm: number;
}

export interface ContractStats {
  total_invoices: number;
  total_funded: number;
  total_paid: number;
  total_volume_usd: number;
  total_protocol_fees_usd?: number;
  feeRateBps?: number;
  volume_by_token: TokenVolume[];
  daily_volume: DailyVolumeBucket[];
  dispute_rate: DisputeRateMetrics;
  provenance?: MetricProvenance;
  /** Indexer ledger and timestamp freshness metadata (#1279). */
  indexerFreshness?: IndexerFreshness;
}

/**
 * Derive honest indexer freshness metadata from observed protocol events.
 * Missing or malformed ledger/timestamp values stay `null` ("unknown") and
 * are never fabricated.
 */
export function deriveStatsIndexerFreshness(
  events: ParsedContractEvent[],
  staleAfterMs: number = DEFAULT_INDEXER_STALE_AFTER_MS
): IndexerFreshness {
  let maxLedger: number | null = null;
  let latestTimestampMs: number | null = null;

  for (const event of events) {
    if (
      typeof event.ledger === 'number' &&
      Number.isSafeInteger(event.ledger) &&
      event.ledger > 0 &&
      (maxLedger === null || event.ledger > maxLedger)
    ) {
      maxLedger = event.ledger;
    }

    if (typeof event.createdAt === 'string') {
      const parsed = Date.parse(event.createdAt);
      if (Number.isFinite(parsed) && (latestTimestampMs === null || parsed > latestTimestampMs)) {
        latestTimestampMs = parsed;
      }
    }
  }

  return {
    lastIndexedLedger: maxLedger,
    lastIndexedAt: latestTimestampMs !== null ? new Date(latestTimestampMs).toISOString() : null,
    staleAfterMs,
  };
}

interface TokenInfo {
  symbol: string;
  decimals: number;
  usdRate: number;
}

function getTokenInfo(tokenId: string | undefined): TokenInfo {
  if (!tokenId) return { symbol: 'USDC', decimals: 6, usdRate: 1.0 };
  const id = tokenId.toLowerCase();
  if (id === TESTNET_USDC_TOKEN_ID.toLowerCase() || id.includes('usdc')) {
    return { symbol: 'USDC', decimals: 6, usdRate: 1.0 };
  }
  if (id === TESTNET_EURC_TOKEN_ID.toLowerCase() || id.includes('eurc')) {
    return { symbol: 'EURC', decimals: 7, usdRate: 1.08 };
  }
  const xlmId = (TESTNET_XLM_TOKEN_ID ?? '').toLowerCase();
  if (id === xlmId || id.includes('xlm') || id.includes('native')) {
    return { symbol: 'XLM', decimals: 7, usdRate: 0.12 };
  }
  return { symbol: 'USDC', decimals: 7, usdRate: 1.0 };
}

function toUsd(amount: bigint, decimals: number, usdRate: number): number {
  return toWholeUnits(amount, decimals) * usdRate;
}

export function buildHistoricalVolume(invoices: Invoice[], days: number): DailyVolumeBucket[] {
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  const buckets = new Map<string, DailyVolumeBucket>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    buckets.set(dateStr, { date: dateStr, label, volume_usd: 0, usdc: 0, eurc: 0, xlm: 0 });
  }

  for (const invoice of invoices) {
    if (!invoice.funded_at || !FUNDED_STATUSES.has(invoice.status)) continue;
    const ts = Number(invoice.funded_at) * 1000;
    if (ts < cutoff) continue;
    const d = new Date(ts);
    const dateStr = d.toISOString().slice(0, 10);
    const bucket = buckets.get(dateStr);
    if (!bucket) continue;

    const { symbol, decimals, usdRate } = getTokenInfo(invoice.token);
    const usd = toUsd(invoice.amount, decimals, usdRate);
    const whole = toWholeUnits(invoice.amount, decimals);
    bucket.volume_usd += usd;
    if (symbol === 'USDC') bucket.usdc += whole;
    else if (symbol === 'EURC') bucket.eurc += whole;
    else if (symbol === 'XLM') bucket.xlm += whole;
    else bucket.usdc += whole;
  }

  return Array.from(buckets.values());
}

export async function get_contract_stats(): Promise<ContractStats> {
  const [invoices, contractEvents] = await Promise.all([
    getAllInvoices(),
    fetchProtocolContractEvents(90),
  ]);

  const protocolParams = await fetchProtocolParameters().catch(() => ({ feeRateBps: 0 }));
  const feeBps = protocolParams.feeRateBps ?? 0;

  let total_funded = 0;
  let total_paid = 0;
  let total_volume_usd = 0;
  let total_protocol_fees_usd = 0;
  const rawVolumes: Record<string, { amount_raw: number; amount_usd: number }> = {};

  for (const invoice of invoices) {
    if (FUNDED_STATUSES.has(invoice.status)) {
      total_funded++;
      const { symbol, decimals, usdRate } = getTokenInfo(invoice.token);
      const usd = toUsd(invoice.amount, decimals, usdRate);
      const whole = toWholeUnits(invoice.amount, decimals);
      total_volume_usd += usd;
      if (!rawVolumes[symbol]) rawVolumes[symbol] = { amount_raw: 0, amount_usd: 0 };
      rawVolumes[symbol].amount_raw += whole;
      rawVolumes[symbol].amount_usd += usd;
      // accumulate protocol fees (fee applies to the discount / yield portion)
      const discount =
        Number((invoice.amount * BigInt(invoice.discount_rate)) / 10_000n) / 10 ** decimals;
      const feeUsd = discount * (feeBps / 10000) * usdRate;
      total_protocol_fees_usd += feeUsd;
    }
    if (invoice.status === 'Paid') total_paid++;
  }

  for (const symbol of ['USDC', 'EURC', 'XLM']) {
    if (!rawVolumes[symbol]) rawVolumes[symbol] = { amount_raw: 0, amount_usd: 0 };
  }

  const volume_by_token: TokenVolume[] = Object.entries(rawVolumes).map(([symbol, v]) => ({
    symbol,
    amount_raw: v.amount_raw,
    amount_usd: v.amount_usd,
    percentage: total_volume_usd > 0 ? (v.amount_usd / total_volume_usd) * 100 : 0,
    color: TOKEN_COLORS[symbol] ?? '#888888',
  }));

  const staleAfterMs = DEFAULT_INDEXER_STALE_AFTER_MS;
  const indexerFreshness = deriveStatsIndexerFreshness(contractEvents, staleAfterMs);

  return {
    total_invoices: invoices.length,
    total_funded,
    total_paid,
    total_volume_usd,
    total_protocol_fees_usd,
    feeRateBps: feeBps,
    volume_by_token,
    daily_volume: buildHistoricalVolume(invoices, 90),
    dispute_rate: computeDisputeRateMetrics(contractEvents),
    provenance: {
      source: 'derived',
      asOf: new Date().toISOString(),
      unit: 'USD-equivalent; token amounts normalized before aggregation',
      staleAfterMs,
    },
    indexerFreshness,
  };
}
