import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchInvoiceNftState } from '../invoice-nft';

/**
 * The scanner decodes event topics/values from base64 XDR via
 * `xdr.ScVal.fromXDR` + `scValToNative`. Feeding it plain (non-base64)
 * strings for topics and a plain object for `value` makes decoding fail and
 * fall back to the raw input (`tryDecodeScValBase64(t) ?? t`), which lets
 * fixtures stay plain JS without needing to construct real XDR. Only the
 * RPC-metadata fallback (`rpc.Server`) needs mocking to avoid a real network
 * call, mirroring the pattern in __tests__/contract/soroban.test.ts.
 */
const { mockServer, isSimulationSuccessMock, scValToNativeMock } = vi.hoisted(() => ({
  mockServer: { simulateTransaction: vi.fn() },
  isSimulationSuccessMock: vi.fn(),
  scValToNativeMock: vi.fn((v: unknown) => v),
}));

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: function MockRpcServer() {
        return mockServer;
      },
      Api: { isSimulationSuccess: (r: unknown) => isSimulationSuccessMock(r) },
    },
    scValToNative: (v: unknown) => scValToNativeMock(v),
  };
});

const dedupedFetchMock = vi.fn((_key: string, fn: () => Promise<unknown>) => fn());
vi.mock('@/lib/horizonClient', () => ({
  dedupedFetch: (...args: [string, () => Promise<unknown>, number]) => dedupedFetchMock(...args),
  TTL: { EVENTS: 60_000 },
}));

vi.mock('@/lib/horizon', () => ({
  getHorizonBaseUrl: () => 'https://horizon-testnet.stellar.org',
}));

const fetchMock = vi.fn();
const HOLDER = 'G' + 'A'.repeat(55);
const OTHER_HOLDER = 'G' + 'B'.repeat(55);

function page(records: unknown[], next?: string) {
  return {
    ok: true,
    json: async () => ({
      _embedded: { records },
      ...(next ? { _links: { next: { href: next } } } : {}),
    }),
  };
}

describe('fetchInvoiceNftState', () => {
  beforeEach(() => {
    dedupedFetchMock.mockClear();
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    mockServer.simulateTransaction.mockReset();
    isSimulationSuccessMock.mockReset();
    isSimulationSuccessMock.mockReturnValue(false);
    scValToNativeMock.mockClear();
  });

  it('returns status "none" and skips metadata resolution when no events match the token', async () => {
    fetchMock.mockResolvedValueOnce(page([]));

    const state = await fetchInvoiceNftState(5n);

    expect(state.status).toBe('none');
    expect(state.transfers).toEqual([]);
    expect(state.metadata).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips events belonging to a different token id', async () => {
    fetchMock.mockResolvedValueOnce(
      page([
        {
          hash: 'tx1',
          events: {
            contractEvents: [{ topics: ['mint'], value: { to: HOLDER, token_id: '999' } }],
          },
        },
      ])
    );

    const state = await fetchInvoiceNftState(5n);
    expect(state.status).toBe('none');
  });

  it('detects a mint event, then falls back through metadata resolution to nothing', async () => {
    fetchMock
      .mockResolvedValueOnce(
        page([
          {
            hash: 'tx-mint',
            created_at: '2026-01-01T00:00:00Z',
            events: {
              contractEvents: [{ topics: ['mint'], value: { to: HOLDER, token_id: '5' } }],
            },
          },
        ])
      )
      // metadata small-page scan: no URI found anywhere
      .mockResolvedValueOnce(page([{ hash: 'tx-mint', events: { contractEvents: [] } }]));

    const state = await fetchInvoiceNftState(5n);

    expect(state.status).toBe('minted');
    expect(state.mintTxHash).toBe('tx-mint');
    expect(state.currentHolder).toBe(HOLDER);
    expect(state.metadata).toBeUndefined();
    expect(isSimulationSuccessMock).toHaveBeenCalled();
  });

  it('records transfer events and sorts them newest first, updating the current holder', async () => {
    fetchMock
      .mockResolvedValueOnce(
        page([
          {
            hash: 'tx-old',
            created_at: '2026-01-01T00:00:00Z',
            events: {
              contractEvents: [
                { topics: ['transfer'], value: { from: HOLDER, to: OTHER_HOLDER, token_id: '5' } },
              ],
            },
          },
          {
            hash: 'tx-new',
            created_at: '2026-01-05T00:00:00Z',
            events: {
              contractEvents: [
                { topics: ['transfer'], value: { from: OTHER_HOLDER, to: HOLDER, token_id: '5' } },
              ],
            },
          },
        ])
      )
      .mockResolvedValueOnce(page([]));

    const state = await fetchInvoiceNftState(5n);

    expect(state.status).toBe('minted');
    expect(state.transfers.map((t) => t.txHash)).toEqual(['tx-new', 'tx-old']);
    expect(state.currentHolder).toBe(HOLDER);
  });

  it('detects a burn event and marks the status as burned', async () => {
    fetchMock
      .mockResolvedValueOnce(
        page([
          {
            hash: 'tx-burn',
            events: { contractEvents: [{ topics: ['burn'], value: { token_id: '5' } }] },
          },
        ])
      )
      .mockResolvedValueOnce(page([]));

    const state = await fetchInvoiceNftState(5n);
    expect(state.status).toBe('burned');
    expect(state.burnTxHash).toBe('tx-burn');
  });

  it('classifies unrecognized-but-token-related events as history line items', async () => {
    fetchMock
      .mockResolvedValueOnce(
        page([
          {
            hash: 'tx-ping',
            events: { contractEvents: [{ topics: ['ping'], value: { token_id: '5', note: 'x' } }] },
          },
        ])
      )
      .mockResolvedValueOnce(page([]));

    const state = await fetchInvoiceNftState(5n);
    expect(state.status).toBe('minted');
    expect(state.transfers).toHaveLength(1);
    expect(state.transfers[0].txHash).toBe('tx-ping');
  });

  it('skips transactions marked unsuccessful', async () => {
    fetchMock.mockResolvedValueOnce(
      page([
        {
          hash: 'tx-failed',
          successful: false,
          events: { contractEvents: [{ topics: ['mint'], value: { to: HOLDER, token_id: '5' } }] },
        },
      ])
    );

    const state = await fetchInvoiceNftState(5n);
    expect(state.status).toBe('none');
  });

  it('paginates across pages via _links.next.href', async () => {
    fetchMock
      .mockResolvedValueOnce(
        page([{ hash: 'tx-empty', events: { contractEvents: [] } }], 'page2-url')
      )
      .mockResolvedValueOnce(
        page([
          {
            hash: 'tx-mint-p2',
            events: {
              contractEvents: [{ topics: ['mint'], value: { to: HOLDER, token_id: '5' } }],
            },
          },
        ])
      )
      .mockResolvedValueOnce(page([]));

    const state = await fetchInvoiceNftState(5n);
    expect(state.status).toBe('minted');
    expect(state.mintTxHash).toBe('tx-mint-p2');
    expect(fetchMock.mock.calls[1][0]).toBe('page2-url');
  });

  it('resolves metadata from an https URI found while scanning for it', async () => {
    fetchMock
      .mockResolvedValueOnce(
        page([
          {
            hash: 'tx-mint',
            events: {
              contractEvents: [{ topics: ['mint'], value: { to: HOLDER, token_id: '5' } }],
            },
          },
        ])
      )
      .mockResolvedValueOnce(
        page([
          {
            hash: 'tx-mint',
            events: {
              contractEvents: [
                {
                  topics: ['mint'],
                  value: { to: HOLDER, token_id: '5', uri: 'https://example.com/meta/5.json' },
                },
              ],
            },
          },
        ])
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Invoice #5',
          description: 'desc',
          image: 'https://example.com/5.png',
          attributes: [{ trait_type: 'status', value: 'paid' }],
        }),
      });

    const state = await fetchInvoiceNftState(5n);

    expect(state.metadata).toMatchObject({
      name: 'Invoice #5',
      description: 'desc',
      image: 'https://example.com/5.png',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://example.com/meta/5.json',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('normalizes an ipfs:// metadata URI to the ipfs.io gateway', async () => {
    fetchMock
      .mockResolvedValueOnce(
        page([
          {
            hash: 'tx-mint',
            events: {
              contractEvents: [{ topics: ['mint'], value: { to: HOLDER, token_id: '5' } }],
            },
          },
        ])
      )
      .mockResolvedValueOnce(
        page([
          {
            hash: 'tx-mint',
            events: {
              contractEvents: [
                { topics: ['mint'], value: { to: HOLDER, token_id: '5', uri: 'ipfs://Qm123' } },
              ],
            },
          },
        ])
      )
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'IPFS meta' }) });

    const state = await fetchInvoiceNftState(5n);

    expect(state.metadata?.name).toBe('IPFS meta');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://ipfs.io/ipfs/Qm123',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('falls back to RPC metadata resolution when the embedded URI fetch fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        page([
          {
            hash: 'tx-mint',
            events: {
              contractEvents: [{ topics: ['mint'], value: { to: HOLDER, token_id: '5' } }],
            },
          },
        ])
      )
      .mockResolvedValueOnce(
        page([
          {
            hash: 'tx-mint',
            events: {
              contractEvents: [
                {
                  topics: ['mint'],
                  value: { to: HOLDER, token_id: '5', uri: 'https://bad.example.com/5.json' },
                },
              ],
            },
          },
        ])
      )
      .mockResolvedValueOnce({ ok: false })
      // the RPC-resolved URI is then fetched too
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'From RPC' }) });

    isSimulationSuccessMock.mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({
      result: { retval: 'https://rpc.example.com/5.json' },
    });

    const state = await fetchInvoiceNftState(5n);

    expect(state.metadata?.name).toBe('From RPC');
    expect(mockServer.simulateTransaction).toHaveBeenCalled();
  });

  it('leaves metadata undefined when the RPC simulation is unsuccessful', async () => {
    fetchMock
      .mockResolvedValueOnce(
        page([
          {
            hash: 'tx-mint',
            events: {
              contractEvents: [{ topics: ['mint'], value: { to: HOLDER, token_id: '5' } }],
            },
          },
        ])
      )
      .mockResolvedValueOnce(page([]));

    isSimulationSuccessMock.mockReturnValue(false);

    const state = await fetchInvoiceNftState(5n);
    expect(state.metadata).toBeUndefined();
  });

  it('returns an error state when the underlying transaction scan fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    const state = await fetchInvoiceNftState(5n);

    expect(state.status).toBe('error');
    expect(state.transfers).toEqual([]);
    expect(state.error).toContain('500');
  });
});
