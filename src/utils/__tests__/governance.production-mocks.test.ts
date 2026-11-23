/**
 * Mock-backed governance behavior must stay out of production builds (#1320).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rpc } from '@stellar/stellar-sdk';
import { governanceMocksAllowed } from '@/lib/governance/mock-guard';
import {
  delegateVotingPower,
  fetchProposals,
  fetchSignerRotations,
  MOCK_SIGNER_ROTATIONS,
  simulateProposalEffect,
} from '../governance';

const SIGNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const emptyHorizonPage = () =>
  new Response(JSON.stringify({ _embedded: { records: [] }, _links: {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => vi.stubEnv('NODE_ENV', 'production'));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('governanceMocksAllowed', () => {
  it.each([
    ['development', true],
    ['test', true],
    ['production', false],
    ['staging', false],
    ['', false],
  ])('NODE_ENV=%s -> %s', (value, expected) => {
    vi.stubEnv('NODE_ENV', value);
    expect(governanceMocksAllowed()).toBe(expected);
  });
});

describe('production governance mock boundary', () => {
  it('rejects stubbed delegation before the wallet is prompted', async () => {
    const signTx = vi.fn();

    await expect(delegateVotingPower(null, SIGNER, signTx)).rejects.toMatchObject({
      code: 'MOCK_ACTION_BLOCKED',
      resubmitSafe: false,
    });
    expect(signTx).not.toHaveBeenCalled();
  });

  it('ignores a mock proposal fallback request', async () => {
    vi.spyOn(rpc.Server.prototype, 'simulateTransaction').mockRejectedValue(new Error('offline'));

    await expect(fetchProposals({ allowMockFallback: true })).rejects.toMatchObject({
      code: 'GOVERNANCE_READ_UNAVAILABLE',
    });
  });

  it('returns no signer rotations for an empty history', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => emptyHorizonPage())
    );

    await expect(fetchSignerRotations()).resolves.toEqual([]);
  });

  it('reports a failed signer rotation read instead of fabricating events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(fetchSignerRotations()).rejects.toMatchObject({
      code: 'GOVERNANCE_READ_UNAVAILABLE',
    });
  });

  it('keeps the signer rotation fixture available outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => emptyHorizonPage())
    );

    await expect(fetchSignerRotations()).resolves.toHaveLength(MOCK_SIGNER_ROTATIONS.length);
  });
});

describe('proposal effect preview provenance (#1322)', () => {
  it('labels the preview as a client estimate and makes no RPC call', async () => {
    const simulate = vi.spyOn(rpc.Server.prototype, 'simulateTransaction');

    const result = await simulateProposalEffect({
      formType: 'FeeRate',
      title: 'Lower fee',
      description: 'Lower the protocol fee',
      newValueBps: 300,
    });

    expect(result).toMatchObject({ isContractVerified: false, provenance: 'client-estimate' });
    expect(simulate).not.toHaveBeenCalled();
  });
});
