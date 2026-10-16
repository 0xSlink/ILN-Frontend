/**
 * Browser client for indexer data.
 *
 * All browser access to the indexer goes through the same-origin proxy at
 * `/api/indexer/*`. This module never sees the upstream URL or credentials,
 * and it turns every failure into a typed `IndexerError`.
 */

import {
  IndexerError,
  indexerErrorCodeForStatus,
  isIndexerErrorCode,
  INDEXER_ERROR_MESSAGES,
} from './errors';
import type { IndexerResourceDataMap, IndexerResourceName, IndexerSuccessEnvelope } from './types';

export const INDEXER_PROXY_BASE = '/api/indexer';
/** Browser-side ceiling; the proxy enforces its own, shorter upstream timeout. */
export const INDEXER_CLIENT_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface FetchIndexerOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Fetch `path` (relative to `/api/indexer`) and validate the envelope.
 * `resource` names the expected resource; a mismatched envelope is a schema error.
 */
export async function fetchIndexer<N extends IndexerResourceName>(
  resource: N,
  path: string,
  { signal, fetchImpl = fetch, timeoutMs = INDEXER_CLIENT_TIMEOUT_MS }: FetchIndexerOptions = {}
): Promise<IndexerSuccessEnvelope<IndexerResourceDataMap[N]>> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    let response: Response;
    try {
      response = await fetchImpl(`${INDEXER_PROXY_BASE}/${path.replace(/^\/+/, '')}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (err) {
      if (timedOut) throw new IndexerError('timeout');
      if (signal?.aborted) throw err;
      throw new IndexerError('network');
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (!response.ok) throw new IndexerError(indexerErrorCodeForStatus(response.status));
      throw new IndexerError('schema');
    }

    if (isRecord(body) && body.ok === false && isRecord(body.error)) {
      const { code, message } = body.error;
      if (isIndexerErrorCode(code)) {
        throw new IndexerError(code, typeof message === 'string' ? message : undefined);
      }
    }
    if (!response.ok) throw new IndexerError(indexerErrorCodeForStatus(response.status));

    if (
      !isRecord(body) ||
      body.ok !== true ||
      body.resource !== resource ||
      !Array.isArray(body.data) ||
      !isRecord(body.meta) ||
      typeof body.meta.droppedRecords !== 'number'
    ) {
      throw new IndexerError('schema');
    }

    return body as unknown as IndexerSuccessEnvelope<IndexerResourceDataMap[N]>;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

export function describeIndexerError(error: unknown): string {
  if (error instanceof IndexerError) return error.message;
  return INDEXER_ERROR_MESSAGES.upstream;
}
