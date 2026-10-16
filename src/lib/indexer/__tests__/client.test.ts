import { describe, expect, it, vi } from 'vitest';
import { fetchIndexer } from '../client';
import { IndexerError } from '../errors';

const okEnvelope = {
  ok: true,
  resource: 'leaderboard',
  data: [{ address: 'GAAA', metric1: 1 }],
  meta: {
    apiVersion: '1.0.0',
    droppedRecords: 0,
    freshness: {
      lastIndexedLedger: 9,
      lastIndexedAt: '2026-10-16T11:59:00.000Z',
      staleAfterMs: 300_000,
    },
  },
};

function respond(body: unknown, status = 200) {
  return vi
    .fn()
    .mockResolvedValue(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
    );
}

async function captureError(promise: Promise<unknown>): Promise<IndexerError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(IndexerError);
    return err as IndexerError;
  }
  throw new Error('expected promise to reject');
}

describe('fetchIndexer', () => {
  it('requests the same-origin proxy and returns the envelope', async () => {
    const fetchImpl = respond(okEnvelope);
    await expect(
      fetchIndexer('leaderboard', 'leaderboard?type=lp', { fetchImpl })
    ).resolves.toEqual(okEnvelope);
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/indexer/leaderboard?type=lp');
  });

  it('surfaces typed error envelopes from the proxy', async () => {
    const fetchImpl = respond(
      {
        ok: false,
        error: { code: 'unauthorized', message: 'The indexer rejected the server credentials.' },
      },
      502
    );
    const err = await captureError(fetchIndexer('leaderboard', 'leaderboard', { fetchImpl }));
    expect(err.code).toBe('unauthorized');
    expect(err.message).toBe('The indexer rejected the server credentials.');
  });

  it.each([
    ['a non-JSON body', '<html>oops</html>'],
    ['a mismatched resource', { ...okEnvelope, resource: 'analytics.funding' }],
    ['non-list data', { ...okEnvelope, data: { rows: [] } }],
    ['missing meta', { ok: true, resource: 'leaderboard', data: [] }],
    ['missing apiVersion', { ...okEnvelope, meta: { ...okEnvelope.meta, apiVersion: undefined } }],
    ['missing freshness', { ...okEnvelope, meta: { ...okEnvelope.meta, freshness: undefined } }],
    [
      'malformed freshness',
      {
        ...okEnvelope,
        meta: {
          ...okEnvelope.meta,
          freshness: { ...okEnvelope.meta.freshness, lastIndexedAt: 'soon' },
        },
      },
    ],
    ['an unknown error code', { ok: false, error: { code: 'teapot', message: 'x' } }],
  ])('treats %s as a schema error', async (_label, body) => {
    const err = await captureError(
      fetchIndexer('leaderboard', 'leaderboard', { fetchImpl: respond(body) })
    );
    expect(err.code).toBe('schema');
  });

  it('maps an unparseable non-2xx response from its status', async () => {
    const err = await captureError(
      fetchIndexer('leaderboard', 'leaderboard', { fetchImpl: respond('Bad gateway', 504) })
    );
    expect(err.code).toBe('timeout');
  });

  it('reports network failures', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await captureError(fetchIndexer('leaderboard', 'leaderboard', { fetchImpl }));
    expect(err.code).toBe('network');
  });

  it('times out when the proxy hangs', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted')));
        })
    );
    const err = await captureError(
      fetchIndexer('leaderboard', 'leaderboard', { fetchImpl, timeoutMs: 20 })
    );
    expect(err.code).toBe('timeout');
  });
});
