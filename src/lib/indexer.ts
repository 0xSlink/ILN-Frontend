/**
 * Authoritative browser indexer API boundary (issue #1101).
 *
 * All browser reads of ActivityFeed and analytics data go through this single
 * server-owned adapter. The client never calls the public indexer directly;
 * instead it calls the Next.js API route at /api/indexer, which forwards to the
 * server-side INDEXER_SERVER_URL with the INDEXER_API_KEY. This keeps schema,
 * auth, timeout, and error contracts explicit and centralised.
 */

export interface IndexerError {
  code: 'INDEXER_UNAVAILABLE' | 'INDEXER_ERROR' | 'BAD_REQUEST' | 'TIMEOUT';
  message: string;
}

export interface IndexerResponse<T> {
  data: T | null;
  unavailable: boolean;
  error: IndexerError | null;
}

const API_BASE = '/api/indexer';
const REQUEST_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('INDEXER_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchIndexer<T>(path: string): Promise<IndexerResponse<T>> {
  try {
    const res = await withTimeout(
      fetch(`${API_BASE}?path=${encodeURIComponent(path)}`, { cache: 'no-store' }),
      REQUEST_TIMEOUT_MS
    );
    if (!res.ok) {
      return {
        data: null,
        unavailable: res.status === 503,
        error: {
          code: res.status === 503 ? 'INDEXER_UNAVAILABLE' : 'INDEXER_ERROR',
          message: `Indexer returned ${res.status}`,
        },
      };
    }
    const data = (await res.json()) as T;
    return { data, unavailable: false, error: null };
  } catch (error) {
    return {
      data: null,
      unavailable: true,
      error: {
        code:
          error instanceof Error && error.message === 'INDEXER_TIMEOUT'
            ? 'TIMEOUT'
            : 'INDEXER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown indexer error',
      },
    };
  }
}

/** Raw invoice event as returned by the indexer (before normalisation). */
export interface InvoiceEventRaw {
  type?: string;
  timestamp?: number | string;
  actor?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function fetchInvoiceEvents(
  invoiceId: string | number | bigint
): Promise<IndexerResponse<InvoiceEventRaw[]>> {
  return fetchIndexer<InvoiceEventRaw[]>(`/invoice/${invoiceId}/events`);
}

export interface DefaultRateBucket {
  date: string;
  defaulted: number;
  funded: number;
  defaultRate: number;
}

export interface DefaultRateResponse {
  monthly?: DefaultRateBucket[];
  [key: string]: unknown;
}

export async function fetchDefaultRate(
  period: string
): Promise<IndexerResponse<DefaultRateResponse>> {
  return fetchIndexer<DefaultRateResponse>(`/analytics/defaults?period=${period}`);
}

export interface DailyFundingBucket {
  date: string;
  total_usdc_equiv: number;
  invoices_funded: number;
  tokens: Array<{ symbol: string; amount: number }>;
}

export interface FundingResponse {
  daily: DailyFundingBucket[];
}

export async function fetchFunding(
  range: string
): Promise<IndexerResponse<FundingResponse>> {
  return fetchIndexer<FundingResponse>(`/v1/analytics/funding?period=${range}`);
}
