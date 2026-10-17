/**
 * Unified indexer API client - single authoritative boundary for all indexer data
 * 
 * This module provides typed, validated access to the indexer API with:
 * - Explicit schema validation
 * - Auth headers when available
 * - Timeout handling
 * - Consistent error contracts
 * - No direct browser-to-indexer calls from components
 */

import { INDEXER_API_URL, INDEXER_SERVER_URL, INDEXER_API_KEY } from '@/constants';

// ─── Types & Schemas ────────────────────────────────────────────────────────────

export interface IndexerError {
  message: string;
  code?: string;
  status?: number;
}

export interface RawInvoiceEvent {
  type?: string;
  timestamp?: number | string;
  actor?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MonthlyDefaultBucket {
  date: string;
  label: string;
  defaulted: number;
  funded: number;
  defaultRate: number;
}

export interface TokenFunding {
  symbol: string;
  amount: number;
  color: string;
}

export interface DailyFundingBucket {
  date: string;
  label: string;
  total_usdc_equiv: number;
  invoices_funded: number;
  tokens: TokenFunding[];
}

export interface FundingResponse {
  daily: DailyFundingBucket[];
}

export interface DefaultRateResponse {
  monthly: MonthlyDefaultBucket[];
}

export interface LeaderboardEntry {
  address: string;
  score: number;
  rank?: number;
  [key: string]: unknown;
}

export interface AnalyticsQuery {
  period?: string;
  startTime?: number;
  endTime?: number;
}

// ─── Client Configuration ───────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const isServer = typeof window === 'undefined';

/**
 * Get the appropriate base URL (client vs server)
 */
function getBaseURL(): string {
  return isServer ? INDEXER_SERVER_URL : INDEXER_API_URL;
}

/**
 * Get auth headers if API key is available (server-side only)
 */
function getAuthHeaders(): Record<string, string> {
  if (isServer && INDEXER_API_KEY) {
    return {
      'Authorization': `Bearer ${INDEXER_API_KEY}`,
      'X-API-Key': INDEXER_API_KEY,
    };
  }
  return {};
}

/**
 * Unified fetch with timeout, auth, and error handling
 */
async function indexerFetch<T>(
  endpoint: string,
  options?: RequestInit & { timeout?: number }
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options || {};
  const url = `${getBaseURL()}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...fetchOptions.headers,
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error: IndexerError = {
        message: `Indexer request failed: ${response.status} ${response.statusText}`,
        status: response.status,
      };
      throw error;
    }

    return (await response.json()) as T;
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        const error: IndexerError = {
          message: `Request timeout after ${timeout}ms`,
          code: 'TIMEOUT',
        };
        throw error;
      }
    }

    throw err;
  }
}

// ─── Public API Methods ─────────────────────────────────────────────────────────

/**
 * Fetch invoice activity events
 */
export async function fetchInvoiceEvents(invoiceId: bigint | string): Promise<RawInvoiceEvent[]> {
  return indexerFetch<RawInvoiceEvent[]>(`/invoice/${invoiceId}/events`);
}

/**
 * Fetch default rate chart data with validated schema
 */
export async function fetchDefaultRateData(
  query?: AnalyticsQuery
): Promise<MonthlyDefaultBucket[]> {
  const params = new URLSearchParams();
  if (query?.startTime) params.set('start', query.startTime.toString());
  if (query?.endTime) params.set('end', query.endTime.toString());
  if (query?.period) params.set('period', query.period);
  
  const queryString = params.toString();
  const response = await indexerFetch<DefaultRateResponse>(
    `/analytics/default-rate${queryString ? `?${queryString}` : ''}`
  );
  
  // Validate and return the monthly data
  if (!response.monthly || !Array.isArray(response.monthly)) {
    throw new Error('Invalid default rate response schema');
  }
  
  return response.monthly;
}

/**
 * Fetch funding chart data with validated schema
 */
export async function fetchFundingData(
  query?: AnalyticsQuery
): Promise<DailyFundingBucket[]> {
  const params = new URLSearchParams();
  if (query?.startTime) params.set('start', query.startTime.toString());
  if (query?.endTime) params.set('end', query.endTime.toString());
  if (query?.period) params.set('period', query.period);
  
  const queryString = params.toString();
  const response = await indexerFetch<FundingResponse>(
    `/v1/analytics/funding${queryString ? `?${queryString}` : ''}`
  );
  
  // Validate and return the daily data
  if (!response.daily || !Array.isArray(response.daily)) {
    throw new Error('Invalid funding response schema');
  }
  
  return response.daily;
}

/**
 * Fetch leaderboard data with validated schema
 */
export async function fetchLeaderboard(
  limit: number = 100,
  metric?: string
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  if (metric) params.set('metric', metric);
  
  const query = params.toString();
  const response = await indexerFetch<LeaderboardEntry[]>(`/leaderboard?${query}`);
  
  // Validate response
  if (!Array.isArray(response)) {
    throw new Error('Invalid leaderboard response schema');
  }
  
  return response;
}

/**
 * Health check - verify indexer availability
 */
export async function checkIndexerHealth(): Promise<boolean> {
  try {
    await indexerFetch<{ status: string }>('/health', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
