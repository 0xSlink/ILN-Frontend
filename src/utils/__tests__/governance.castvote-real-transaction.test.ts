/**
 * Regression coverage for the #651 write-path gap: `castVote` must build and
 * sign a real Soroban `cast_vote` transaction, return the hash the network
 * issued, and never fabricate a tally by mutating MOCK_PROPOSALS.
 *
 * The RPC harness replaces only the transport; the XDR handed to `signTx` is
 * decoded below to prove the contract call is really there.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionBuilder, type Transaction } from '@stellar/stellar-sdk';

vi.mock('@/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/constants')>();
  return {
    ...actual,
    GOVERNANCE_CONTRACT_CONFIGURED: true,
    GOVERNANCE_CONTRACT_ID: 'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC',
  };
});

import { NETWORK_PASSPHRASE } from '@/constants';
import {
  castVote,
  clearGovernanceIdempotencyCache,
  getUserVote,
  MOCK_PROPOSALS,
} from '../governance';
import {
  createGovernanceRpcStub,
  governanceWriteOptions,
  passthroughSignTx,
} from '@/test-utils/governance-rpc';
import {
  clearGovernanceTestSession,
  establishGovernanceTestSession,
} from './helpers/governanceSession';

const SIGNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function tallySnapshot() {
  return MOCK_PROPOSALS.map((p) => ({
    id: p.id,
    status: p.status,
    votesFor: p.votesFor,
    votesAgainst: p.votesAgainst,
  }));
}

beforeEach(() => {
  clearGovernanceIdempotencyCache();
  establishGovernanceTestSession(SIGNER);
});

afterEach(() => {
  clearGovernanceTestSession();
  vi.restoreAllMocks();
});

describe('castVote real Soroban transaction (#651)', () => {
  it('signs a real cast_vote XDR and returns the hash issued by the network', async () => {
    const stub = createGovernanceRpcStub();
    const signTx = passthroughSignTx();
    const before = tallySnapshot();

    const hash = await castVote(1, 'For', SIGNER, signTx, governanceWriteOptions(stub));

    // The signer callback is invoked exactly once, with a parseable envelope
    // that invokes the governance contract's cast_vote entry point.
    expect(signTx).toHaveBeenCalledTimes(1);
    const signedXdr = signTx.mock.calls[0][0] as string;
    const submitted = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as Transaction;
    expect(submitted.operations).toHaveLength(1);
    const invoke = submitted.operations[0] as unknown as {
      func?: { _value?: { _attributes?: { functionName?: Buffer | { data: number[] } } } };
    };
    const fn = invoke.func?._value?._attributes?.functionName;
    const fnName = Buffer.isBuffer(fn) ? fn.toString() : Buffer.from(fn?.data ?? []).toString();
    expect(fnName).toBe('cast_vote');

    // The returned value is the RPC submission hash — not a local/random one.
    expect(hash).toBe(stub.issuedHashes[0]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stub.sendTransaction).toHaveBeenCalledTimes(1);

    // No in-memory tally mutation; the next contract read supplies the result.
    expect(tallySnapshot()).toEqual(before);
    expect(getUserVote(1)).toBe('For');
  });

  it('does not ask the wallet to sign when the dry run fails', async () => {
    const stub = createGovernanceRpcStub();
    const signTx = passthroughSignTx();

    await expect(
      castVote(2, 'Against', SIGNER, signTx, {
        ...governanceWriteOptions(stub),
        simulate: async () => ({ success: false, error: 'SIMULATION_UNAUTHORIZED' }),
      })
    ).rejects.toThrow(/GOVERNANCE_SIMULATION_FAILED/);

    expect(signTx).not.toHaveBeenCalled();
    expect(stub.sendTransaction).not.toHaveBeenCalled();
  });
});
