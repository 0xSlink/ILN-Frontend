import { describe, it, expect, vi, afterEach } from 'vitest';
import { server } from '@/mocks/server';
import {
  injectRpcFault,
  injectRpcMalformed,
  injectRpcNetworkError,
  injectRpcTimeout,
  injectHorizonFault,
  injectHorizonMalformed,
  injectHorizonTransactionsFault,
} from '@/mocks/faultInjection';
import {
  fetchParameterUpdates,
  fetchProposals,
  fetchQuorumThreshold,
  fetchVotesForAddress,
} from '@/utils/governance';
import {
  fetchHorizonAccount,
  fetchNativeXlmBalance,
  __resetHorizonClient,
} from '@/lib/horizonClient';

afterEach(() => {
  server.resetHandlers();
  __resetHorizonClient();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('fault injection: RPC contract-call sites', () => {
  it('falls back to mock proposals when RPC returns 500', async () => {
    server.use(injectRpcFault(500));
    const proposals = await fetchProposals();
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals[0]).toHaveProperty('title');
  });

  it('falls back to mock proposals when RPC returns malformed non-JSON response', async () => {
    server.use(injectRpcMalformed());
    const proposals = await fetchProposals();
    expect(proposals.length).toBeGreaterThan(0);
  });

  it('falls back to mock proposals when RPC is unreachable (network error)', async () => {
    server.use(injectRpcNetworkError());
    const proposals = await fetchProposals();
    expect(proposals.length).toBeGreaterThan(0);
  });

  it('does not crash while the RPC endpoint is unresponsive (timeout)', async () => {
    server.use(injectRpcTimeout(60_000));
    vi.useFakeTimers();

    const pending = fetchProposals();
    let settled = 'pending';
    const race = pending.then(
      () => {
        settled = 'resolved';
      },
      () => {
        settled = 'rejected';
      }
    );

    await vi.advanceTimersByTimeAsync(5_000);
    expect(settled).toBe('pending');

    await vi.advanceTimersByTimeAsync(60_000);
    await race;
    expect(settled).toBe('resolved');
  });

  it('returns 0 (graceful fallback) when RPC fails during quorum threshold fetch', async () => {
    server.use(injectRpcFault(500));
    const threshold = await fetchQuorumThreshold();
    expect(threshold).toBe(0);
  });
});

describe('fault injection: Horizon call sites', () => {
  const TEST_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

  it('rejects with a clear error when Horizon /accounts returns 500', async () => {
    server.use(injectHorizonFault(500));
    __resetHorizonClient();
    await expect(fetchHorizonAccount(TEST_ADDRESS)).rejects.toThrow(
      /Horizon account fetch failed: 500/
    );
  });

  it('rejects when Horizon /accounts returns malformed data', async () => {
    server.use(injectHorizonMalformed());
    __resetHorizonClient();
    await expect(fetchHorizonAccount(TEST_ADDRESS)).rejects.toThrow();
  });

  it('propagates Horizon faults through the XLM balance wrapper', async () => {
    server.use(injectHorizonFault(503));
    __resetHorizonClient();
    await expect(fetchNativeXlmBalance(TEST_ADDRESS)).rejects.toThrow(
      /Horizon account fetch failed: 503/
    );
  });
});

describe('fault injection: governance Horizon event reads', () => {
  it('returns fallback data when the Horizon governance transactions endpoint returns 500', async () => {
    server.use(injectHorizonTransactionsFault(500));
    const [updates, votes] = await Promise.all([
      fetchParameterUpdates(),
      fetchVotesForAddress('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'),
    ]);
    expect(Array.isArray(updates)).toBe(true);
    expect(Array.isArray(votes)).toBe(true);
  });
});
