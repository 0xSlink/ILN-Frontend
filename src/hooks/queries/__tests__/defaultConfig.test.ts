import { describe, expect, it } from 'vitest';
import { DEFAULT_QUERY_CONFIG, createQueryConfig } from '../defaultConfig';

describe('defaultConfig', () => {
  it('defines consistent application-wide query defaults', () => {
    expect(DEFAULT_QUERY_CONFIG.staleTime).toBe(30_000);
    expect(DEFAULT_QUERY_CONFIG.gcTime).toBe(5 * 60_000);
    expect(DEFAULT_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
    expect(DEFAULT_QUERY_CONFIG.retry).toBe(2);
  });

  it('merges custom overrides into default config', () => {
    const config = createQueryConfig({ staleTime: 60_000, enabled: false });
    expect(config.staleTime).toBe(60_000);
    expect(config.gcTime).toBe(5 * 60_000);
    expect(config.refetchOnWindowFocus).toBe(false);
    expect(config.enabled).toBe(false);
  });
});
