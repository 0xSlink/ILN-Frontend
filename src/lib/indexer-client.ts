/**
 * Authoritative client boundary for indexer REST interactions (#1106, #1107, #1108, #1109).
 *
 * Provides:
 * 1. Runtime schema validation rejecting malformed records (#1106).
 * 2. Bounded timeouts and deterministic AbortSignal cancellation (#1107).
 * 3. Safe retry and exponential backoff for transient failures (#1108).
 * 4. Normalized typed error states (unavailable, unauthorized, rate-limited, empty, malformed) (#1109).
 */

import {
  INDEXER_API_URL,
  INDEXER_SERVER_URL,
  INDEXER_API_KEY,
  INDEXER_DEFAULT_TIMEOUT_MS,
  INDEXER_DEFAULT_RETRIES,
  INDEXER_DEFAULT_BACKOFF_MS,
  INDEXER_MAX_BACKOFF_MS,
} from '@/constants';
import type { IndexerBoundaryStatus } from '@/lib/indexer-boundary';
import type { MonthlyDefaultBucket, MonthlyDefaultWithMA } from '@/utils/defaultRate';
import { calculateMovingAverage } from '@/utils/defaultRate';
import type { DailyFundingBucket } from '@/components/charts/FundingChart';

// ─── Error Types & Classification (#1109) ───────────────────────────────────

export type IndexerErrorType =
  | 'unavailable'
  | 'unauthorized'
  | 'rate-limited'
  | 'empty'
  | 'malformed'
  | 'timeout'
  | 'aborted'
  | 'unknown';

export interface IndexerClientErrorOptions {
  type: IndexerErrorType;
  message: string;
  status?: number;
  boundaryStatus: IndexerBoundaryStatus;
  retryAfterSeconds?: number;
  isRetryable?: boolean;
  cause?: unknown;
}

export class IndexerClientError extends Error {
  readonly type: IndexerErrorType;
  readonly status?: number;
  readonly boundaryStatus: IndexerBoundaryStatus;
  readonly retryAfterSeconds?: number;
  readonly isRetryable: boolean;

  constructor(options: IndexerClientErrorOptions) {
    super(options.message);
    this.name = 'IndexerClientError';
    this.type = options.type;
    this.status = options.status;
    this.boundaryStatus = options.boundaryStatus;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.isRetryable = options.isRetryable ?? false;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof IndexerClientError && err.type === 'aborted') return true;
  if (err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('aborted'))) {
    return true;
  }
  return false;
}

export function classifyIndexerClientError(err: unknown): IndexerBoundaryStatus {
  if (err instanceof IndexerClientError) {
    return err.boundaryStatus;
  }
  if (err && typeof err === 'object') {
    if ('boundaryStatus' in err && typeof (err as { boundaryStatus: unknown }).boundaryStatus === 'string') {
      return (err as { boundaryStatus: IndexerBoundaryStatus }).boundaryStatus;
    }
    if ('status' in err && typeof (err as { status: unknown }).status === 'number') {
      const code = (err as { status: number }).status;
      if (code === 401 || code === 403) return 'unauthorized';
      if (code === 429) return 'rate-limited';
      if (code >= 500) return 'unavailable';
      if (code === 400 || code === 422) return 'malformed';
    }
  }
  if (isAbortError(err)) {
    return 'unavailable';
  }
  return 'unavailable';
}

// ─── Options & Contracts (#1107, #1108) ──────────────────────────────────────

export interface IndexerFetchOptions<T = unknown> {
  baseUrl?: string;
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  cache?: RequestCache;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  apiKey?: string;
  validate?: (data: unknown) => T;
}

export interface IndexerRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new IndexerClientError({
        type: 'aborted',
        message: 'Request was cancelled by user',
        boundaryStatus: 'unavailable',
        isRetryable: false,
      }));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new IndexerClientError({
        type: 'aborted',
        message: 'Request was cancelled during backoff',
        boundaryStatus: 'unavailable',
        isRetryable: false,
      }));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const seconds = Number(headerValue);
  if (!Number.isNaN(seconds) && seconds >= 0) return seconds;
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    const diff = Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
    return diff;
  }
  return undefined;
}

// ─── Runtime Schema Validation (#1106) ───────────────────────────────────────

export interface RawInvoiceEvent {
  type?: string;
  timestamp?: number | string;
  actor?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export function validateInvoiceEvents(payload: unknown): RawInvoiceEvent[] {
  if (!Array.isArray(payload)) {
    throw new IndexerClientError({
      type: 'malformed',
      message: 'Indexer activity feed payload must be an array of event objects',
      status: 422,
      boundaryStatus: 'malformed',
      isRetryable: false,
    });
  }

  for (let i = 0; i < payload.length; i++) {
    const item = payload[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new IndexerClientError({
        type: 'malformed',
        message: `Indexer event record at index ${i} is not a valid object`,
        status: 422,
        boundaryStatus: 'malformed',
        isRetryable: false,
      });
    }
  }

  return payload as RawInvoiceEvent[];
}

export function validateDefaultAnalytics(payload: unknown): MonthlyDefaultBucket[] {
  if (!payload || typeof payload !== 'object') {
    throw new IndexerClientError({
      type: 'malformed',
      message: 'Indexer default analytics payload must be an object or array',
      status: 422,
      boundaryStatus: 'malformed',
      isRetryable: false,
    });
  }

  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { monthly?: unknown }).monthly)
      ? (payload as { monthly: unknown[] }).monthly
      : null;

  if (!rawList) {
    throw new IndexerClientError({
      type: 'malformed',
      message: 'Indexer default analytics payload missing monthly bucket array',
      status: 422,
      boundaryStatus: 'malformed',
      isRetryable: false,
    });
  }

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item !== 'object') {
      throw new IndexerClientError({
        type: 'malformed',
        message: `Indexer monthly default bucket at index ${i} is not an object`,
        status: 422,
        boundaryStatus: 'malformed',
        isRetryable: false,
      });
    }
    const b = item as Record<string, unknown>;
    if (
      typeof b.date !== 'string' ||
      typeof b.label !== 'string' ||
      typeof b.defaulted !== 'number' ||
      typeof b.funded !== 'number' ||
      typeof b.defaultRate !== 'number'
    ) {
      throw new IndexerClientError({
        type: 'malformed',
        message: `Indexer monthly default bucket at index ${i} has invalid field types`,
        status: 422,
        boundaryStatus: 'malformed',
        isRetryable: false,
      });
    }
  }

  return rawList as MonthlyDefaultBucket[];
}

export function validateFundingAnalytics(payload: unknown): DailyFundingBucket[] {
  if (!payload || typeof payload !== 'object') {
    throw new IndexerClientError({
      type: 'malformed',
      message: 'Indexer funding analytics payload must be an object or array',
      status: 422,
      boundaryStatus: 'malformed',
      isRetryable: false,
    });
  }

  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { daily?: unknown }).daily)
      ? (payload as { daily: unknown[] }).daily
      : null;

  if (!rawList) {
    throw new IndexerClientError({
      type: 'malformed',
      message: 'Indexer funding analytics payload missing daily bucket array',
      status: 422,
      boundaryStatus: 'malformed',
      isRetryable: false,
    });
  }

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item !== 'object') {
      throw new IndexerClientError({
        type: 'malformed',
        message: `Indexer daily funding bucket at index ${i} is not an object`,
        status: 422,
        boundaryStatus: 'malformed',
        isRetryable: false,
      });
    }
    const b = item as Record<string, unknown>;
    if (
      typeof b.date !== 'string' ||
      typeof b.label !== 'string' ||
      typeof b.total_usdc_equiv !== 'number' ||
      typeof b.invoices_funded !== 'number' ||
      !Array.isArray(b.tokens)
    ) {
      throw new IndexerClientError({
        type: 'malformed',
        message: `Indexer daily funding bucket at index ${i} has invalid field types`,
        status: 422,
        boundaryStatus: 'malformed',
        isRetryable: false,
      });
    }
  }

  return rawList as DailyFundingBucket[];
}

export function validateLeaderboardData<T = unknown[]>(payload: unknown): T {
  if (!Array.isArray(payload)) {
    throw new IndexerClientError({
      type: 'malformed',
      message: 'Indexer leaderboard payload must be an array of ranking entries',
      status: 422,
      boundaryStatus: 'malformed',
      isRetryable: false,
    });
  }

  for (let i = 0; i < payload.length; i++) {
    const item = payload[i];
    if (!item || typeof item !== 'object') {
      throw new IndexerClientError({
        type: 'malformed',
        message: `Indexer leaderboard entry at index ${i} is not an object`,
        status: 422,
        boundaryStatus: 'malformed',
        isRetryable: false,
      });
    }
  }

  return payload as unknown as T;
}

// ─── Authoritative Indexer Fetch Boundary ───────────────────────────────────

export async function fetchIndexer<T = unknown>(
  path: string,
  options: IndexerFetchOptions<T> = {}
): Promise<T> {
  const {
    baseUrl = INDEXER_API_URL,
    method = 'GET',
    headers: customHeaders = {},
    cache = 'no-store',
    signal: userSignal,
    timeoutMs = INDEXER_DEFAULT_TIMEOUT_MS,
    retries = INDEXER_DEFAULT_RETRIES,
    baseBackoffMs = process.env.NODE_ENV === 'test' ? 0 : INDEXER_DEFAULT_BACKOFF_MS,
    maxBackoffMs = process.env.NODE_ENV === 'test' ? 0 : INDEXER_MAX_BACKOFF_MS,
    apiKey = INDEXER_API_KEY,
    validate,
  } = options;

  const url = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

  const isIdempotent = method === 'GET' || method === 'HEAD';
  const effectiveMaxRetries = isIdempotent ? Math.max(0, retries) : 0;

  let attempt = 0;

  while (true) {
    if (userSignal?.aborted) {
      throw new IndexerClientError({
        type: 'aborted',
        message: 'Indexer request aborted by consumer',
        boundaryStatus: 'unavailable',
        isRetryable: false,
      });
    }

    const abortController = new AbortController();
    let isTimedOut = false;

    const timeoutTimer = setTimeout(() => {
      isTimedOut = true;
      abortController.abort();
    }, timeoutMs);

    const onUserAbort = () => {
      abortController.abort();
    };

    if (userSignal) {
      userSignal.addEventListener('abort', onUserAbort, { once: true });
    }

    const requestHeaders: Record<string, string> = { ...customHeaders };
    if (apiKey) {
      requestHeaders['X-API-Key'] = apiKey;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        cache,
        signal: abortController.signal,
      });

      clearTimeout(timeoutTimer);
      if (userSignal) {
        userSignal.removeEventListener('abort', onUserAbort);
      }

      if (response.ok) {
        let json: unknown;
        try {
          json = await response.json();
        } catch (parseErr) {
          throw new IndexerClientError({
            type: 'malformed',
            message: 'Indexer response was not valid JSON',
            status: response.status,
            boundaryStatus: 'malformed',
            cause: parseErr,
            isRetryable: false,
          });
        }

        if (validate) {
          return validate(json);
        }

        return json as T;
      }

      // Non-2xx responses
      const status = response.status ?? 500;
      const retryAfterSeconds = response.headers?.get
        ? parseRetryAfter(response.headers.get('Retry-After'))
        : undefined;

      if (status === 401 || status === 403) {
        throw new IndexerClientError({
          type: 'unauthorized',
          message: `Indexer request unauthorized (HTTP ${status})`,
          status,
          boundaryStatus: 'unauthorized',
          isRetryable: false,
        });
      }

      if (status === 429) {
        const clientError = new IndexerClientError({
          type: 'rate-limited',
          message: 'Indexer rate limit exceeded (HTTP 429)',
          status,
          boundaryStatus: 'rate-limited',
          retryAfterSeconds,
          isRetryable: attempt < effectiveMaxRetries && (retryAfterSeconds ?? 0) <= 2,
        });

        if (clientError.isRetryable && retryAfterSeconds && retryAfterSeconds > 0) {
          attempt++;
          await sleep(retryAfterSeconds * 1000, userSignal);
          continue;
        }

        throw clientError;
      }

      if (status === 400 || status === 422) {
        throw new IndexerClientError({
          type: 'malformed',
          message: `Indexer rejected malformed query (HTTP ${status})`,
          status,
          boundaryStatus: 'malformed',
          isRetryable: false,
        });
      }

      // 5xx server errors are transient and retryable
      const isTransient = status >= 500 && status <= 599;
      const error = new IndexerClientError({
        type: 'unavailable',
        message: `Indexer server error (HTTP ${status})`,
        status,
        boundaryStatus: 'unavailable',
        isRetryable: isTransient && attempt < effectiveMaxRetries,
      });

      if (error.isRetryable) {
        attempt++;
        const backoff = Math.min(
          maxBackoffMs,
          baseBackoffMs * 2 ** (attempt - 1) + Math.random() * 50
        );
        await sleep(backoff, userSignal);
        continue;
      }

      throw error;
    } catch (err) {
      clearTimeout(timeoutTimer);
      if (userSignal) {
        userSignal.removeEventListener('abort', onUserAbort);
      }

      if (err instanceof IndexerClientError) {
        throw err;
      }

      if (userSignal?.aborted) {
        throw new IndexerClientError({
          type: 'aborted',
          message: 'Indexer request aborted by consumer',
          boundaryStatus: 'unavailable',
          cause: err,
          isRetryable: false,
        });
      }

      if (isTimedOut) {
        const timeoutError = new IndexerClientError({
          type: 'timeout',
          message: `Indexer request timed out after ${timeoutMs}ms`,
          boundaryStatus: 'unavailable',
          cause: err,
          isRetryable: attempt < effectiveMaxRetries,
        });

        if (timeoutError.isRetryable) {
          attempt++;
          const backoff = Math.min(
            maxBackoffMs,
            baseBackoffMs * 2 ** (attempt - 1) + Math.random() * 50
          );
          await sleep(backoff, userSignal);
          continue;
        }

        throw timeoutError;
      }

      // Network failures
      const networkError = new IndexerClientError({
        type: 'unavailable',
        message: err instanceof Error ? err.message : 'Network error reaching indexer',
        boundaryStatus: 'unavailable',
        cause: err,
        isRetryable: isIdempotent && attempt < effectiveMaxRetries,
      });

      if (networkError.isRetryable) {
        attempt++;
        const backoff = Math.min(
          maxBackoffMs,
          baseBackoffMs * 2 ** (attempt - 1) + Math.random() * 50
        );
        await sleep(backoff, userSignal);
        continue;
      }

      throw networkError;
    }
  }
}

// ─── High-Level Scoped Production Endpoints ─────────────────────────────────

export async function fetchInvoiceEvents(
  invoiceId: bigint | string,
  options: IndexerRequestOptions = {}
): Promise<RawInvoiceEvent[]> {
  return fetchIndexer<RawInvoiceEvent[]>(`/invoice/${invoiceId}/events`, {
    ...options,
    validate: validateInvoiceEvents,
  });
}

export async function fetchDefaultAnalytics(
  period: string = '12m',
  options: IndexerRequestOptions = {}
): Promise<MonthlyDefaultWithMA[]> {
  const buckets = await fetchIndexer<MonthlyDefaultBucket[]>(
    `/analytics/defaults?period=${encodeURIComponent(period)}`,
    {
      ...options,
      validate: validateDefaultAnalytics,
    }
  );
  return calculateMovingAverage(buckets, 1);
}

export async function fetchFundingAnalytics(
  period: string = '30d',
  options: IndexerRequestOptions = {}
): Promise<DailyFundingBucket[]> {
  return fetchIndexer<DailyFundingBucket[]>(
    `/v1/analytics/funding?period=${encodeURIComponent(period)}`,
    {
      ...options,
      validate: validateFundingAnalytics,
    }
  );
}

export interface LeaderboardResult<T = unknown[]> {
  data: T;
  unavailable: boolean;
  status?: IndexerBoundaryStatus;
  error?: string;
}

export async function fetchLeaderboard<T = unknown[]>(
  type: string,
  period: string,
  options: IndexerRequestOptions = {}
): Promise<LeaderboardResult<T>> {
  const indexerUrl = process.env.INDEXER_URL || INDEXER_SERVER_URL;
  if (!process.env.INDEXER_URL && !process.env.NEXT_PUBLIC_INDEXER_API_URL) {
    return { data: [] as unknown as T, unavailable: false, status: 'empty' };
  }

  try {
    const data = await fetchIndexer<T>(
      `/leaderboard?type=${encodeURIComponent(type)}&period=${encodeURIComponent(period)}`,
      {
        ...options,
        baseUrl: indexerUrl,
        apiKey: process.env.INDEXER_API_KEY || INDEXER_API_KEY,
        validate: validateLeaderboardData,
      }
    );

    const isArr = Array.isArray(data);
    const boundaryStatus: IndexerBoundaryStatus =
      isArr && data.length === 0 ? 'empty' : 'loading';

    return {
      data,
      unavailable: false,
      status: boundaryStatus === 'empty' ? 'empty' : undefined,
    };
  } catch (error) {
    const boundaryStatus = classifyIndexerClientError(error);
    const isUnavailable = boundaryStatus === 'unavailable' || boundaryStatus === 'malformed';
    return {
      data: [] as unknown as T,
      unavailable: isUnavailable,
      status: boundaryStatus,
      error: error instanceof Error ? error.message : 'Failed to fetch leaderboard',
    };
  }
}
