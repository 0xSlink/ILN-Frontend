'use client';

import { useEffect, useState } from 'react';
import useMediaQuery from './useMediaQuery';

/** Media query that matches when the user has requested reduced motion. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Returns `true` when the user has expressed a preference for reduced motion
 * (e.g. via the OS "reduce motion" accessibility setting). Components that
 * animate should consult this hook and fall back to an instant/static state.
 *
 * SSR-safe: returns `false` during server render and the first client render
 * (matching `useMediaQuery`), then syncs to the real preference in an effect.
 *
 * @example
 * const reducedMotion = useReducedMotion();
 * if (reducedMotion) return <StaticValue />;
 * return <AnimatedValue />;
 */
export default function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}
