'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchIndexer } from '@/lib/indexer/client';
import { IndexerError } from '@/lib/indexer/errors';
import type {
  IndexerResourceDataMap,
  IndexerResourceName,
  IndexerResponseMeta,
} from '@/lib/indexer/types';

type SettledState<N extends IndexerResourceName> =
  | {
      status: 'success';
      data: IndexerResourceDataMap[N];
      meta: IndexerResponseMeta;
      error: null;
    }
  | { status: 'error'; data: null; meta: null; error: IndexerError };

export type IndexerResourceState<N extends IndexerResourceName> =
  | { status: 'loading'; data: null; meta: null; error: null }
  | SettledState<N>;

const LOADING = { status: 'loading', data: null, meta: null, error: null } as const;

/**
 * Load an indexer resource through the `/api/indexer` proxy.
 * Re-fetches when `path` changes; `retry()` re-runs the current request.
 */
export function useIndexerResource<N extends IndexerResourceName>(resource: N, path: string) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${resource}:${path}:${attempt}`;
  const [settled, setSettled] = useState<{ key: string; state: SettledState<N> } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchIndexer(resource, path, { signal: controller.signal })
      .then((envelope) => {
        if (controller.signal.aborted) return;
        setSettled({
          key: requestKey,
          state: { status: 'success', data: envelope.data, meta: envelope.meta, error: null },
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setSettled({
          key: requestKey,
          state: {
            status: 'error',
            data: null,
            meta: null,
            error: err instanceof IndexerError ? err : new IndexerError('upstream'),
          },
        });
      });

    return () => controller.abort();
  }, [resource, path, requestKey]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // A result for an older request key means the current request is still in flight.
  const state: IndexerResourceState<N> = settled?.key === requestKey ? settled.state : LOADING;

  return { ...state, retry };
}
