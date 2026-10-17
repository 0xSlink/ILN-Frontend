import { useCallback, useEffect, useMemo, useState } from 'react';
import { trackEvent } from '@/lib/analytics';

export interface VisibleWindow<T> {
  /**
   * Number of items currently rendered. The rest are revealed on demand via
   * `loadMore`, keeping the mounted DOM bounded regardless of list size.
   */
  visibleCount: number;
  /** Whether more items remain beyond the current window. */
  hasMore: boolean;
  /** Number of items still hidden behind the current window. */
  remaining: number;
  /** Reveal the next page/batch of items (a no-op when nothing remains). */
  loadMore: () => void;
  /** Hide rows past the visible count so the list stays bounded. */
  visibleSlice: (items: T[]) => T[];
}

const DEFAULT_PAGE_SIZE = 50;

/**
 * Bounds how many list items are mounted at once. Rendering the full set of a
 * mainnet-scale invoice list (thousands of entries) into the DOM degrades
 * scroll/interaction performance, so we render a growing window and expose a
 * "Load more" button. See docs/load-testing.md.
 *
 * The window resets to `pageSize` whenever any of `resetDeps` change so that
 * filtering/sorting surfaces items from the start again.
 */
export function useVisibleWindow<T>(
  items: T[],
  pageSize = DEFAULT_PAGE_SIZE,
  resetDeps: unknown[] = [],
  listName?: string
): VisibleWindow<T> {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset the visible window when the underlying data/deps change.
    setVisibleCount(pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, ...resetDeps]);

  useEffect(() => {
    trackEvent('list:visible-window', {
      list: listName,
      visibleCount,
      total: items.length,
      hasMore: items.length > visibleCount,
    });
  }, [listName, visibleCount, items.length]);

  const hasMore = items.length > visibleCount;
  const remaining = Math.max(0, items.length - visibleCount);

  const loadMore = useCallback(() => {
    setVisibleCount((count) => Math.min(count + pageSize, items.length));
  }, [pageSize, items.length]);

  const visibleSlice = useCallback((list: T[]) => list.slice(0, visibleCount), [visibleCount]);

  return useMemo(
    () => ({ visibleCount, hasMore, remaining, loadMore, visibleSlice }),
    [visibleCount, hasMore, remaining, loadMore, visibleSlice]
  );
}
