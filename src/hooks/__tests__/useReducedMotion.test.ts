import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import useReducedMotion from '../useReducedMotion';

type Listener = (e: { matches: boolean }) => void;

function mockReducedMotion(matches: boolean) {
  let listener: Listener | null = null;
  const mql = {
    matches,
    media: '',
    addEventListener: vi.fn((_: string, cb: Listener) => {
      listener = cb;
    }),
    removeEventListener: vi.fn(() => {
      listener = null;
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      mql.media = query;
      return mql;
    }),
  });
  return {
    emit: (next: boolean) => {
      mql.matches = next;
      act(() => listener?.({ matches: next }));
    },
  };
}

describe('useReducedMotion', () => {
  const original = window.matchMedia;
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: original,
    });
  });

  it('returns false when reduced motion is not preferred', () => {
    mockReducedMotion(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when reduced motion is preferred', () => {
    mockReducedMotion(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates live when the preference changes', () => {
    const { emit } = mockReducedMotion(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    emit(true);
    expect(result.current).toBe(true);
  });
});
