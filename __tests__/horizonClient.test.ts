/**
 * Tests for src/lib/horizonClient.ts
 *
 * Covers:
 *  - TTL-based response caching
 *  - In-flight deduplication (identical concurrent calls share one promise)
 *  - Microtask-batched account fetches (multiple addresses → parallel fetches,
 *    same address within one tick → single fetch)
 *  - fetchNativeXlmBalance convenience wrapper
 *  - fetchHomeDomain convenience wrapper
 *  - invalidateCache / invalidateCachePrefix helpers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  dedupedFetch,
  fetchHorizonAccount,
  fetchNativeXlmBalance,
  fetchHomeDomain,
  invalidateCache,
  invalidateCachePrefix,
  __resetHorizonClient,
  TTL,
} from '@/lib/horizonClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAccount(address: string, xlmBalance = '100.0000000') {
  return {
    id: address,
    account_id: address,
    home_domain: 'example.com',
    balances: [
      { asset_type: 'native', balance: xlmBalance },
      { asset_type: 'credit_alphanum4', asset_code: 'USDC', balance: '50.0000000' },
    ],
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  __resetHorizonClient();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ─── dedupedFetch ─────────────────────────────────────────────────────────────

describe('dedupedFetch', () => {
  it('calls fetcher once and caches the result', async () => {
    const fetcher = vi.fn().mockResolvedValue(42);

    const r1 = await dedupedFetch('key1', fetcher, 5_000);
    const r2 = await dedupedFetch('key1', fetcher, 5_000);

    expect(r1).toBe(42);
    expect(r2).toBe(42);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent in-flight requests', async () => {
    let resolveInner!: (v: string) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<string>((res) => {
          resolveInner = res;
        })
    );

    const p1 = dedupedFetch('key2', fetcher, 5_000);
    const p2 = dedupedFetch('key2', fetcher, 5_000);

    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveInner('hello');
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe('hello');
    expect(r2).toBe('hello');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after TTL expires', async () => {
    const fetcher = vi.fn().mockResolvedValue('v1');

    await dedupedFetch('key3', fetcher, 1_000);
    vi.advanceTimersByTime(1_001);
    fetcher.mockResolvedValue('v2');
    const result = await dedupedFetch('key3', fetcher, 1_000);

    expect(result).toBe('v2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not cache on error and allows retry', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('ok');

    await expect(dedupedFetch('key4', fetcher, 5_000)).rejects.toThrow('network error');
    const result = await dedupedFetch('key4', fetcher, 5_000);

    expect(result).toBe('ok');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

// ─── invalidateCache ──────────────────────────────────────────────────────────

describe('invalidateCache', () => {
  it('forces a re-fetch after manual invalidation', async () => {
    const fetcher = vi.fn().mockResolvedValue('first');
    await dedupedFetch('inv1', fetcher, 60_000);

    invalidateCache('inv1');
    fetcher.mockResolvedValue('second');
    const result = await dedupedFetch('inv1', fetcher, 60_000);

    expect(result).toBe('second');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('invalidateCachePrefix', () => {
  it('invalidates all keys with the given prefix', async () => {
    const f1 = vi.fn().mockResolvedValue('a');
    const f2 = vi.fn().mockResolvedValue('b');
    const f3 = vi.fn().mockResolvedValue('c');

    await dedupedFetch('balance:ADDR1:TOKEN1', f1, 60_000);
    await dedupedFetch('balance:ADDR1:TOKEN2', f2, 60_000);
    await dedupedFetch('other:ADDR1', f3, 60_000);

    invalidateCachePrefix('balance:ADDR1');

    f1.mockResolvedValue('a2');
    f2.mockResolvedValue('b2');

    const r1 = await dedupedFetch('balance:ADDR1:TOKEN1', f1, 60_000);
    const r2 = await dedupedFetch('balance:ADDR1:TOKEN2', f2, 60_000);
    const r3 = await dedupedFetch('other:ADDR1', f3, 60_000);

    expect(r1).toBe('a2');
    expect(r2).toBe('b2');
    expect(r3).toBe('c'); // not invalidated
    expect(f3).toHaveBeenCalledTimes(1);
  });
});

// ─── fetchHorizonAccount (batch deduplication) ────────────────────────────────

/**
 * Account fetches are batched behind a `setTimeout(..., 0)`. With fake timers
 * the callers never settle until the timer runs, so the pending promise has to
 * be created first and awaited only after the timers are flushed.
 */
async function settle<T>(pending: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return pending;
}

describe('fetchHorizonAccount', () => {
  it('batches multiple calls for the same address into one fetch', async () => {
    const account = makeAccount('GABC');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(account), { status: 200 }));

    const [r1, r2, r3] = await settle(
      Promise.all([
        fetchHorizonAccount('GABC'),
        fetchHorizonAccount('GABC'),
        fetchHorizonAccount('GABC'),
      ])
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(r1.account_id).toBe('GABC');
    expect(r2).toBe(r1);
    expect(r3).toBe(r1);
  });

  it('fetches different addresses in parallel (one fetch each)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        const addr = url.split('/accounts/')[1];
        return new Response(JSON.stringify(makeAccount(addr)), { status: 200 });
      });

    await settle(Promise.all([fetchHorizonAccount('GABC'), fetchHorizonAccount('GDEF')]));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns empty balances for a 404 (unfunded account)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }));

    const result = await settle(fetchHorizonAccount('GUNFUNDED'));

    expect(result.balances).toHaveLength(0);
  });

  it('serves subsequent calls from cache within TTL', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(makeAccount('GCACHED')), { status: 200 }));

    await settle(fetchHorizonAccount('GCACHED'));
    await settle(fetchHorizonAccount('GCACHED'));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after BALANCE TTL expires', async () => {
    // A Response body can only be read once, so build a fresh one per call.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async () => new Response(JSON.stringify(makeAccount('GTTL')), { status: 200 })
      );

    await settle(fetchHorizonAccount('GTTL'));

    vi.advanceTimersByTime(TTL.BALANCE + 1);
    __resetHorizonClient(); // clear cache to simulate expiry without time travel issues

    await settle(fetchHorizonAccount('GTTL'));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

// ─── fetchNativeXlmBalance ────────────────────────────────────────────────────

describe('fetchNativeXlmBalance', () => {
  it('returns the native balance from the account', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeAccount('GXLM', '250.5000000')), { status: 200 })
    );

    const balance = await settle(fetchNativeXlmBalance('GXLM'));

    expect(balance).toBe(250.5);
  });

  it('returns 0 for an unfunded account (404)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }));

    const balance = await settle(fetchNativeXlmBalance('GNEW'));

    expect(balance).toBe(0);
  });

  it('deduplicates concurrent calls for the same address', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(makeAccount('GDUP', '10.0000000')), { status: 200 })
      );

    const [b1, b2] = await settle(
      Promise.all([fetchNativeXlmBalance('GDUP'), fetchNativeXlmBalance('GDUP')])
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(b1).toBe(10);
    expect(b2).toBe(10);
  });
});

// ─── fetchHomeDomain ──────────────────────────────────────────────────────────

describe('fetchHomeDomain', () => {
  it('returns the home_domain from the account', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeAccount('GDOMAIN')), { status: 200 })
    );

    const domain = await settle(fetchHomeDomain('GDOMAIN'));

    expect(domain).toBe('example.com');
  });

  it('returns null when account has no home_domain', async () => {
    const account = { ...makeAccount('GNODOMAIN'), home_domain: undefined };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(account), { status: 200 })
    );

    const domain = await settle(fetchHomeDomain('GNODOMAIN'));

    expect(domain).toBeNull();
  });

  it('caches the result for FEDERATION TTL', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(makeAccount('GCACHE2')), { status: 200 }));

    await settle(fetchHomeDomain('GCACHE2'));
    await settle(fetchHomeDomain('GCACHE2'));

    // Only one Horizon fetch despite two calls
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
