import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useVisibleWindow } from '../useVisibleWindow';

const items = Array.from({ length: 100 }, (_, i) => i);

describe('useVisibleWindow', () => {
  it('bounds the rendered window to pageSize and reports remaining items', () => {
    const { result } = renderHook(() => useVisibleWindow(items, 50));

    expect(result.current.visibleCount).toBe(50);
    expect(result.current.visibleSlice(items)).toEqual(items.slice(0, 50));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.remaining).toBe(50);
  });

  it('grows the window on loadMore until nothing remains', () => {
    const { result } = renderHook(() => useVisibleWindow(items, 50));

    act(() => result.current.loadMore());
    expect(result.current.visibleCount).toBe(100);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.remaining).toBe(0);

    // loadMore is a no-op once exhausted.
    act(() => result.current.loadMore());
    expect(result.current.visibleCount).toBe(100);
  });

  it('reports no remaining for lists smaller than the page size', () => {
    const small = [1, 2, 3];
    const { result } = renderHook(() => useVisibleWindow(small));

    expect(result.current.visibleCount).toBe(50);
    expect(result.current.visibleSlice(small)).toEqual(small);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.remaining).toBe(0);
  });

  it('resets the window when a reset dep changes, revealing items from the start', () => {
    const { result, rerender } = renderHook(({ dep }) => useVisibleWindow(items, 50, [dep]), {
      initialProps: { dep: 'a' },
    });

    act(() => result.current.loadMore());
    expect(result.current.visibleCount).toBe(100);

    rerender({ dep: 'b' });
    expect(result.current.visibleCount).toBe(50);
    expect(result.current.visibleSlice(items)).toEqual(items.slice(0, 50));
  });
});
