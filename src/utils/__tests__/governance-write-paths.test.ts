/**
 * Regression coverage for the governance write-path reality gaps:
 * `executeProposal` and `createProposal` must submit real Soroban transactions,
 * wire the wallet signing callback, return the network-issued hash and never
 * fabricate local state. The implementation now lives in the shared governance
 * mutation pipeline; these tests pin the externally observable contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/constants')>();
  return {
    ...actual,
    GOVERNANCE_CONTRACT_CONFIGURED: true,
    GOVERNANCE_CONTRACT_ID: 'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC',
  };
});

import {
  clearGovernanceIdempotencyCache,
  createProposal,
  executeProposal,
  MOCK_PROPOSALS,
} from '@/utils/governance';
import {
  createGovernanceRpcStub,
  governanceWriteOptions,
  passthroughSignTx,
} from '@/test-utils/governance-rpc';
import {
  clearGovernanceTestSession,
  establishGovernanceTestSession,
} from '@/utils/__tests__/helpers/governanceSession';

const SIGNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

describe('governance write-path regression (real transactions)', () => {
  beforeEach(() => {
    clearGovernanceIdempotencyCache();
    establishGovernanceTestSession(SIGNER);
  });

  afterEach(() => {
    clearGovernanceTestSession();
  });

  it('executeProposal crosses simulate → sign → submit → confirm and returns the issued hash', async () => {
    const stub = createGovernanceRpcStub();
    const signTx = passthroughSignTx();
    const statusesBefore = MOCK_PROPOSALS.map((p) => p.status);

    const hash = await executeProposal(6, SIGNER, signTx, governanceWriteOptions(stub));

    expect(hash).toBe(stub.issuedHashes[0]);
    expect(stub.getAccount).toHaveBeenCalledWith(SIGNER);
    expect(stub.simulateTransaction).toHaveBeenCalledTimes(1);
    expect(signTx).toHaveBeenCalledTimes(1);
    expect(stub.sendTransaction).toHaveBeenCalledTimes(1);
    expect(stub.getTransaction).toHaveBeenCalled();
    // Status is contract-owned — no local mutation.
    expect(MOCK_PROPOSALS.map((p) => p.status)).toEqual(statusesBefore);
  });

  it('createProposal returns the contract-assigned id and issued hash without a local record', async () => {
    const stub = createGovernanceRpcStub({ proposalId: 77 });
    const signTx = passthroughSignTx();
    const countBefore = MOCK_PROPOSALS.length;

    const result = await createProposal(
      {
        formType: 'FeeRate',
        title: 'Real fee-rate update',
        description: 'Submitted through the governance contract',
        newValueBps: 30,
      },
      SIGNER,
      signTx,
      governanceWriteOptions(stub)
    );

    expect(result).toEqual({ txHash: stub.issuedHashes[0], proposalId: 77 });
    expect(stub.simulateTransaction).toHaveBeenCalledTimes(1);
    expect(signTx).toHaveBeenCalledTimes(1);
    expect(stub.sendTransaction).toHaveBeenCalledTimes(1);
    expect(MOCK_PROPOSALS).toHaveLength(countBefore);
    expect(MOCK_PROPOSALS.find((p) => p.id === 77)).toBeUndefined();
  });
});
