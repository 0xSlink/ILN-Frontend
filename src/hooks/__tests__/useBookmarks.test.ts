import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBookmarks } from '../useBookmarks';

const STORAGE_KEY = 'iln-bookmarks';

describe('useBookmarks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty when nothing is stored', () => {
    const { result } = renderHook(() => useBookmarks());
    expect(result.current.count).toBe(0);
    expect(result.current.atLimit).toBe(false);
  });

  it('loads previously bookmarked ids', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['1', '2']));
    const { result } = renderHook(() => useBookmarks());
    expect(result.current.isBookmarked('1')).toBe(true);
    expect(result.current.isBookmarked('3')).toBe(false);
    expect(result.current.count).toBe(2);
  });

  it('falls back to empty when stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');
    const { result } = renderHook(() => useBookmarks());
    expect(result.current.count).toBe(0);
  });

  it('adds and removes a bookmark, persisting to localStorage', () => {
    const { result } = renderHook(() => useBookmarks());

    act(() => result.current.toggleBookmark('7', true));
    expect(result.current.isBookmarked('7')).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['7']);

    act(() => result.current.toggleBookmark('7', false));
    expect(result.current.isBookmarked('7')).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
  });

  it('refuses to add once at the 100-bookmark limit', () => {
    const many = Array.from({ length: 100 }, (_, i) => String(i));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(many));
    const { result } = renderHook(() => useBookmarks());
    expect(result.current.atLimit).toBe(true);

    act(() => result.current.toggleBookmark('overflow', true));
    expect(result.current.isBookmarked('overflow')).toBe(false);
    expect(result.current.count).toBe(100);
  });

  it('clears all bookmarks', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['1', '2', '3']));
    const { result } = renderHook(() => useBookmarks());

    act(() => result.current.clearAll());
    expect(result.current.count).toBe(0);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
  });

  it('silently ignores a localStorage write failure', () => {
    const { result } = renderHook(() => useBookmarks());
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => act(() => result.current.toggleBookmark('1', true))).not.toThrow();
    setItemSpy.mockRestore();
  });
});
