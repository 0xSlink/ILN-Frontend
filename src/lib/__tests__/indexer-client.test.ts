/**
 * Tests for the authoritative indexer client boundary:
 * - Runtime schema validation (#1106)
 * - Timeout and cancellation policy (#1107)
 * - Retry and backoff policy (#1108)
 * - Normalized error states (#1109)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchIndexer,
  fetchInvoiceEvents,
  fetchDefaultAnalytics,
  fetchFundingAnalytics,
  validateInvoiceEvents,
  validateDefaultAnalytics,
  validateFundingAnalytics,
  validateLeaderboardData,
  IndexerClientError,
  classifyIndexerClientError,
  isAbortError,
} from '../indexer-client';

describe('Indexer Schema Validation (#1106)', () => {
  describe('validateInvoiceEvents', () => {
    it('accepts valid invoice events array', () => {
      const valid = [
        { type: 'submitted', timestamp: 1234567890, actor: 'GABC' },
        { type: 'funded', timestamp: 1234567900, data: { amount: '100' } },
      ];
      expect(validateInvoiceEvents(valid)).toEqual(valid);
    });

    it('rejects non-array payloads', () => {
      expect(() => validateInvoiceEvents({ events: [] })).toThrow(IndexerClientError);
      expect(() => validateInvoiceEvents('malformed')).toThrow(IndexerClientError);
      expect(() => validateInvoiceEvents(null)).toThrow(IndexerClientError);
    });

    it('rejects arrays with primitive or null items', () => {
      expect(() => validateInvoiceEvents(['submitted', 123])).toThrow(IndexerClientError);
      expect(() => validateInvoiceEvents([null])).toThrow(IndexerClientError);
    });
  });

  describe('validateDefaultAnalytics', () => {
    it('accepts valid monthly default bucket records', () => {
      const valid = {
        monthly: [
          { date: '2026-01', label: 'Jan 2026', defaulted: 0, funded: 10, defaultRate: 0 },
        ],
      };
      expect(validateDefaultAnalytics(valid)).toEqual(valid.monthly);
    });

    it('rejects invalid or missing bucket fields', () => {
      expect(() => validateDefaultAnalytics({})).toThrow(IndexerClientError);
      expect(() =>
        validateDefaultAnalytics({
          monthly: [{ date: '2026-01', label: 'Jan', defaulted: 'not-a-number' }],
        })
      ).toThrow(IndexerClientError);
    });
  });

  describe('validateFundingAnalytics', () => {
    it('accepts valid daily funding records', () => {
      const valid = {
        daily: [
          {
            date: '2026-01-01',
            label: 'Jan 1',
            total_usdc_equiv: 5000,
            invoices_funded: 3,
            tokens: [{ symbol: 'USDC', amount: 5000, color: '#008080' }],
          },
        ],
      };
      expect(validateFundingAnalytics(valid)).toEqual(valid.daily);
    });

    it('rejects non-object or malformed daily buckets', () => {
      expect(() => validateFundingAnalytics(null)).toThrow(IndexerClientError);
      expect(() =>
        validateFundingAnalytics({
          daily: [{ date: '2026-01-01', total_usdc_equiv: 'invalid' }],
        })
      ).toThrow(IndexerClientError);
    });
  });

  describe('validateLeaderboardData', () => {
    it('accepts valid leaderboard array', () => {
      const valid = [{ address: 'G123', totalFunded: 1000 }];
      expect(validateLeaderboardData(valid)).toEqual(valid);
    });

    it('rejects non-array leaderboard data', () => {
      expect(() => validateLeaderboardData({ error: 'corrupted' })).toThrow(IndexerClientError);
    });
  });
});

describe('Indexer Timeout & Cancellation Policy (#1107)', () => {
  const globalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = globalFetch;
    vi.clearAllMocks();
  });

  it('aborts and throws timeout error when deadline is exceeded', async () => {
    (global.fetch as any).mockImplementation((_url: string, opts: any) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });

    await expect(
      fetchIndexer('/test-timeout', { timeoutMs: 15, retries: 0 })
    ).rejects.toThrow(/timed out/i);
  });

  it('aborts immediately when caller signal is triggered', async () => {
    const controller = new AbortController();
    (global.fetch as any).mockImplementation((_url: string, opts: any) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });

    const promise = fetchIndexer('/test-cancel', { signal: controller.signal, retries: 0 });
    controller.abort();

    await expect(promise).rejects.toThrow(/aborted/i);
    expect(isAbortError(new IndexerClientError({ type: 'aborted', message: 'aborted', boundaryStatus: 'unavailable' }))).toBe(true);
  });
});

describe('Indexer Retry and Backoff Policy (#1108)', () => {
  const globalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = globalFetch;
    vi.clearAllMocks();
  });

  it('retries transient 503 error and resolves when second attempt succeeds', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      });

    const result = await fetchIndexer<{ status: string }>('/test-retry', { retries: 1 });
    expect(result).toEqual({ status: 'ok' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry permanent 400 or 401 client errors', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    });

    await expect(fetchIndexer('/test-unauthorized', { retries: 2 })).rejects.toThrow(
      IndexerClientError
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('Indexer Normalized Error States (#1109)', () => {
  const globalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = globalFetch;
    vi.clearAllMocks();
  });

  it('maps 401/403 to unauthorized', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    });

    try {
      await fetchIndexer('/test-401', { retries: 0 });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(classifyIndexerClientError(err)).toBe('unauthorized');
    }
  });

  it('maps 429 to rate-limited', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers(),
    });

    try {
      await fetchIndexer('/test-429', { retries: 0 });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(classifyIndexerClientError(err)).toBe('rate-limited');
    }
  });

  it('maps 503 to unavailable', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers(),
    });

    try {
      await fetchIndexer('/test-503', { retries: 0 });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(classifyIndexerClientError(err)).toBe('unavailable');
    }
  });

  it('maps malformed response body to malformed', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('invalid json');
      },
    });

    try {
      await fetchIndexer('/test-malformed', { retries: 0 });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(classifyIndexerClientError(err)).toBe('malformed');
    }
  });
});
