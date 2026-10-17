import { CONTRACT_ID } from '@/constants';
import {
  parseContractEventsFromTransaction,
  type ParsedContractEvent,
} from '@/lib/contract-events';
import { getHorizonBaseUrl } from '@/lib/horizon';
import { dedupedFetch, TTL } from '@/lib/horizonClient';

const MS_PER_DAY = 86_400_000;
const DEFAULT_LOOKBACK_DAYS = 90;
const MAX_PAGES = 15;

interface HorizonTxRecord {
  hash?: string;
  created_at?: string;
  ledger?: number;
  successful?: boolean;
  events?: {
    contractEvents?: Array<{
      topics?: string[];
      value?: string;
      type?: string;
      id?: string;
    }>;
  };
}

interface HorizonTxResponse {
  _embedded?: { records?: HorizonTxRecord[] };
  _links?: { next?: { href?: string } };
}

async function fetchTransactionsPage(url: string): Promise<HorizonTxResponse> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Horizon transaction fetch failed: ${res.status}`);
  }
  return (await res.json()) as HorizonTxResponse;
}

/** Fetch recent contract events (newest first) for the homepage activity feed. */
export async function fetchRecentProtocolContractEvents(): Promise<ParsedContractEvent[]> {
  const cacheKey = `protocol-contract-events:recent-feed`;

  return dedupedFetch(
    cacheKey,
    async () => {
      const base = getHorizonBaseUrl();
      const url = `${base}/transactions?accounts=${encodeURIComponent(
        CONTRACT_ID
      )}&order=desc&limit=200`;
      const pageResp = await fetchTransactionsPage(url);
      const events: ParsedContractEvent[] = [];

      for (const tx of pageResp._embedded?.records ?? []) {
        events.push(...parseContractEventsFromTransaction(tx));
      }

      return events.sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
    },
    TTL.EVENTS
  );
}

/** Fetch ILN contract events from Horizon for the last `lookbackDays` days. */
export async function fetchProtocolContractEvents(
  lookbackDays = DEFAULT_LOOKBACK_DAYS
): Promise<ParsedContractEvent[]> {
  const cacheKey = `protocol-contract-events:${CONTRACT_ID}:${lookbackDays}`;

  return dedupedFetch(
    cacheKey,
    async () => {
      const cutoffMs = Date.now() - lookbackDays * MS_PER_DAY;
      const base = getHorizonBaseUrl();
      let url = `${base}/transactions?accounts=${encodeURIComponent(
        CONTRACT_ID
      )}&order=desc&limit=200`;
      const events: ParsedContractEvent[] = [];

      for (let page = 0; page < MAX_PAGES; page += 1) {
        const pageResp = await fetchTransactionsPage(url);
        const records = pageResp._embedded?.records ?? [];
        if (records.length === 0) break;

        let reachedCutoff = false;

        for (const tx of records) {
          const createdAt = tx.created_at;
          if (createdAt) {
            const ts = Date.parse(createdAt);
            if (Number.isFinite(ts) && ts < cutoffMs) {
              reachedCutoff = true;
              continue;
            }
          }

          events.push(...parseContractEventsFromTransaction(tx));
        }

        if (reachedCutoff) break;

        const nextHref = pageResp._links?.next?.href;
        if (!nextHref) break;
        url = nextHref;
      }

      return events;
    },
    TTL.EVENTS
  );
}
