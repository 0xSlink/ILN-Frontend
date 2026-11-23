import type { ContractEventType, ParsedContractEvent } from '@/lib/contract-events';
import type { Invoice } from '@/utils/soroban';
import { TESTNET_USDC_TOKEN_ID, TESTNET_EURC_TOKEN_ID, TESTNET_XLM_TOKEN_ID } from '@/constants';

export const PROTOCOL_FEED_EVENT_TYPES = [
  'InvoiceSubmitted',
  'InvoiceFunded',
  'InvoicePaid',
  'InvoiceDisputed',
] as const;

export type ProtocolFeedEventType = (typeof PROTOCOL_FEED_EVENT_TYPES)[number];

export interface ProtocolFeedItem {
  id: string;
  eventType: ProtocolFeedEventType;
  label: string;
  icon: string;
  invoiceId: string;
  amount: string;
  token: string;
  dateLabel: string;
  timestampMs: number;
}

const FEED_EVENT_LABELS: Record<ProtocolFeedEventType, { label: string; icon: string }> = {
  InvoiceSubmitted: { label: 'Invoice Submitted', icon: 'description' },
  InvoiceFunded: { label: 'Invoice Funded', icon: 'payments' },
  InvoicePaid: { label: 'Invoice Settled', icon: 'check_circle' },
  InvoiceDisputed: { label: 'Invoice Disputed', icon: 'gavel' },
};

export function isProtocolFeedEventType(type: ContractEventType): type is ProtocolFeedEventType {
  return (PROTOCOL_FEED_EVENT_TYPES as readonly string[]).includes(type);
}

function resolveToken(tokenId: string | undefined): { symbol: string; decimals: number } {
  if (!tokenId) return { symbol: 'USDC', decimals: 6 };
  const id = tokenId.toLowerCase();
  if (id === TESTNET_USDC_TOKEN_ID.toLowerCase() || id.includes('usdc')) {
    return { symbol: 'USDC', decimals: 6 };
  }
  if (id === TESTNET_EURC_TOKEN_ID.toLowerCase() || id.includes('eurc')) {
    return { symbol: 'EURC', decimals: 7 };
  }
  const xlmId = (TESTNET_XLM_TOKEN_ID ?? '').toLowerCase();
  if (id === xlmId || id.includes('xlm') || id.includes('native')) {
    return { symbol: 'XLM', decimals: 7 };
  }
  return { symbol: 'USDC', decimals: 6 };
}

export function formatFeedAmountValue(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const wholePart = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (decimals === 0 || fraction === 0n) {
    return wholePart;
  }

  const rawFraction = fraction.toString().padStart(decimals, '0');
  const fractionPart = whole === 0n ? rawFraction : rawFraction.replace(/0+$/, '');
  return `${wholePart}.${fractionPart}`;
}

function eventTimestampMs(event: ParsedContractEvent): number {
  if (!event.createdAt) return 0;
  const ts = Date.parse(event.createdAt);
  return Number.isFinite(ts) ? ts : 0;
}

function formatFeedDate(timestampMs: number): string {
  if (timestampMs <= 0) return '—';
  return new Date(timestampMs).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Canonical deduplication key for a protocol feed event (#1282).
 *
 * Each feed-visible lifecycle transition (`InvoiceSubmitted`, `InvoiceFunded`,
 * `InvoicePaid`, `InvoiceDisputed`) maps to one canonical key per
 * `(eventType, invoiceId)`. Replayed polls that re-emit the same transition,
 * or reorg / indexer backfills that re-deliver the transition at a corrected
 * ledger or timestamp, collide on this key so the UI never displays duplicate
 * rows or conflicting entries for the same transition.
 */
export function protocolFeedEventKey(event: ParsedContractEvent): string | null {
  if (!isProtocolFeedEventType(event.type) || event.invoiceId === undefined) {
    return null;
  }
  return `${event.type}:${event.invoiceId.toString()}`;
}

/**
 * Decides whether `candidate` supersedes `existing` for the same canonical
 * feed key during replay or reorg / corrected-data reconciliation (#1282):
 *
 * 1. Higher valid `ledger` wins (reorg or corrected canonical ledger replaces
 *    the older/orphaned entry; stale replays at a lower ledger are ignored).
 * 2. When `ledger` is equal (or absent on both), a strictly newer valid
 *    `createdAt` timestamp wins (corrected metadata replaces stale/missing
 *    timestamps).
 * 3. When both `ledger` and `createdAt` match, the incoming event is an exact
 *    replay and is discarded (first canonical record preserved).
 */
function shouldSupersedeFeedEvent(
  existing: ParsedContractEvent,
  candidate: ParsedContractEvent
): boolean {
  const existingLedger = typeof existing.ledger === 'number' && Number.isFinite(existing.ledger)
    ? existing.ledger
    : -1;
  const candidateLedger = typeof candidate.ledger === 'number' && Number.isFinite(candidate.ledger)
    ? candidate.ledger
    : -1;

  if (candidateLedger !== existingLedger) {
    return candidateLedger > existingLedger;
  }

  const existingTs = eventTimestampMs(existing);
  const candidateTs = eventTimestampMs(candidate);
  return candidateTs > existingTs;
}

/**
 * Deduplicate replayed protocol events and reconcile reorg / corrected event
 * records before rendering (#1282).
 *
 * - Drops non-feed event types and malformed events missing `invoiceId`.
 * - Collapses identical replays to a single entry.
 * - Replaces superseded entries when a corrected/reorged record arrives with
 *   a higher ledger (or newer valid timestamp on ledger tie).
 * - Ignores stale replays whose ledger/timestamp is older than the accepted record.
 */
export function deduplicateProtocolFeedEvents(
  events: ParsedContractEvent[]
): ParsedContractEvent[] {
  const byKey = new Map<string, ParsedContractEvent>();

  for (const event of events) {
    const key = protocolFeedEventKey(event);
    if (!key) continue;

    const existing = byKey.get(key);
    if (!existing || shouldSupersedeFeedEvent(existing, event)) {
      byKey.set(key, event);
    }
  }

  return Array.from(byKey.values());
}

/**
 * Merge a new poll batch into previously retained events using the same
 * deduplication and reorg-replacement rules (#1282).
 */
export function mergeProtocolFeedEvents(
  existing: ParsedContractEvent[],
  incoming: ParsedContractEvent[]
): ParsedContractEvent[] {
  return deduplicateProtocolFeedEvents([...existing, ...incoming]);
}

/**
 * Build the last N homepage feed items from contract events and invoice data.
 *
 * Replayed events are deduplicated by canonical `(eventType, invoiceId)` key
 * and reorged/corrected records supersede stale ones before sorting and
 * applying `limit` (#1282).
 */
export function buildProtocolFeedItems(
  events: ParsedContractEvent[],
  invoicesById: Map<string, Invoice>,
  limit = 10
): ProtocolFeedItem[] {
  if (limit <= 0) return [];

  const deduped = deduplicateProtocolFeedEvents(events);
  const sorted = deduped.sort((a, b) => {
    const tsDiff = eventTimestampMs(b) - eventTimestampMs(a);
    if (tsDiff !== 0) return tsDiff;
    const ledgerDiff = (b.ledger ?? 0) - (a.ledger ?? 0);
    if (ledgerDiff !== 0) return ledgerDiff;
    return (b.invoiceId ?? 0n) > (a.invoiceId ?? 0n) ? 1 : (b.invoiceId ?? 0n) < (a.invoiceId ?? 0n) ? -1 : 0;
  });

  const items: ProtocolFeedItem[] = [];

  for (const event of sorted) {
    if (items.length >= limit) break;
    if (event.invoiceId === undefined) continue;

    const invoiceId = event.invoiceId.toString();
    const invoice = invoicesById.get(invoiceId);
    const tokenMeta = resolveToken(invoice?.token);
    const amountValue = invoice ? formatFeedAmountValue(invoice.amount, tokenMeta.decimals) : '—';
    const timestampMs = eventTimestampMs(event);
    const meta = FEED_EVENT_LABELS[event.type as ProtocolFeedEventType];

    items.push({
      id: `${event.type}-${invoiceId}-${timestampMs}-${event.ledger ?? 0}`,
      eventType: event.type as ProtocolFeedEventType,
      label: meta.label,
      icon: meta.icon,
      invoiceId,
      amount: amountValue,
      token: tokenMeta.symbol,
      dateLabel: formatFeedDate(timestampMs),
      timestampMs,
    });
  }

  return items;
}
