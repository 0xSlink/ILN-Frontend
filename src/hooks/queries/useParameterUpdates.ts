'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchParameterUpdates, type ParameterUpdateEvent } from '@/utils/governance';
import { governanceKeys, QUERY_TIMINGS } from './keys';
import { createQueryConfig } from './defaultConfig';

/** Default announcement window: only surface changes from the last 48 hours. */
export const PARAMETER_UPDATE_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Fetch recently-enacted protocol parameter changes for announcement banners (#153).
 *
 * Returns only the changes that took effect within {@link PARAMETER_UPDATE_WINDOW_MS}
 * (48h by default), newest first. Consumers — see {@link ParameterUpdateBanner} —
 * handle per-event dismissal and how many to show at once.
 *
 * @param windowMs override the recency window (mainly for testing).
 */
export function useParameterUpdates(windowMs: number = PARAMETER_UPDATE_WINDOW_MS) {
  return useQuery<ParameterUpdateEvent[], Error, ParameterUpdateEvent[]>({
    queryKey: governanceKeys.parameterUpdates,
    queryFn: fetchParameterUpdates,
    ...createQueryConfig({
      ...QUERY_TIMINGS.parameterUpdates,
      select: (events) => {
        const cutoff = Date.now() / 1000 - windowMs / 1000;
        return events.filter((event) => event.updatedAt >= cutoff);
      },
    }),
  });
}
