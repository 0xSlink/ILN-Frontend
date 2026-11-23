/**
 * Duplicate and stale governance writes through the public API (#1323).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGovernanceRpcStub, governanceWriteOptions } from '@/test-utils/governance-rpc';
import { PENDING_TRANSACTIONS_STORAGE_KEY } from '@/lib/pending-transactions';
import {
  castVote,
  clearGovernanceIdempotencyCache,
  executeProposal,
  vetoProposal,
} from '../governance';
import {
  clearGovernanceTestSession,
  establishGovernanceTestSession,
} from './helpers/governanceSession';

vi.mock('@/constants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/constants')>()),
  GOVERNANCE_CONTRACT_CONFIGURED: true,
  GOVERNANCE_CONTRACT_ID: 'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC',
}));

const SIGNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const REASON_HASH = 'e'.repeat(64);
const signTx = () => vi.fn(async (xdr: string) => xdr);

beforeEach(() => {
  localStorage.removeItem(PENDING_TRANSACTIONS_STORAGE_KEY);
  clearGovernanceIdempotencyCache();
  establishGovernanceTestSession(SIGNER);
});

afterEach(() => {
  clearGovernanceTestSession();
  vi.restoreAllMocks();
});

describe('concurrent governance writes (#1323)', () => {
  it('shares one transaction between duplicate execute requests', async () => {
    const stub = createGovernanceRpcStub();
    const sign = signTx();
    const options = governanceWriteOptions(stub);

    const [first, second] = await Promise.all([
      executeProposal(11, SIGNER, sign, options),
      executeProposal(11, SIGNER, sign, options),
    ]);

    expect(first).toBe(second);
    expect(sign).toHaveBeenCalledTimes(1);
    expect(stub.sendTransaction).toHaveBeenCalledTimes(1);
  });

  it('shares one transaction between duplicate vote requests', async () => {
    const stub = createGovernanceRpcStub();
    const sign = signTx();
    const options = governanceWriteOptions(stub);

    await Promise.all([
      castVote(12, 'For', SIGNER, sign, options),
      castVote(12, 'For', SIGNER, sign, options),
    ]);

    expect(stub.sendTransaction).toHaveBeenCalledTimes(1);
  });

  it('shares one transaction between duplicate veto requests', async () => {
    const stub = createGovernanceRpcStub();
    const sign = signTx();
    const options = governanceWriteOptions(stub);

    await Promise.all([
      vetoProposal(13, REASON_HASH, SIGNER, sign, options),
      vetoProposal(13, REASON_HASH, SIGNER, sign, options),
    ]);

    expect(stub.sendTransaction).toHaveBeenCalledTimes(1);
  });

  it('blocks a re-signed execution after a confirmation timeout', async () => {
    const stub = createGovernanceRpcStub({ confirmation: 'never' });
    const sign = signTx();
    const options = governanceWriteOptions(stub);

    await expect(executeProposal(14, SIGNER, sign, options)).rejects.toMatchObject({
      code: 'TX_TIMEOUT',
    });
    await expect(executeProposal(14, SIGNER, sign, options)).rejects.toMatchObject({
      code: 'DUPLICATE_PENDING',
      resubmitSafe: false,
    });

    expect(sign).toHaveBeenCalledTimes(1);
    expect(stub.sendTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('stale execution state (#1323)', () => {
  it.each([
    ['vetoed', { id: 15, status: 'Vetoed' }],
    ['already executed', { id: 15, status: 'Executed' }],
    ['before its ETA', { id: 15, status: 'Passed', executableAfter: 4_000_000_000 }],
    ['missing', null],
  ])('does not open the wallet for a %s proposal', async (_label, proposal) => {
    const stub = createGovernanceRpcStub();
    const sign = signTx();

    await expect(
      executeProposal(15, SIGNER, sign, {
        ...governanceWriteOptions(stub),
        readProposal: async () => proposal,
      })
    ).rejects.toMatchObject({ code: 'PROPOSAL_NOT_EXECUTABLE' });

    expect(sign).not.toHaveBeenCalled();
    expect(stub.simulateTransaction).not.toHaveBeenCalled();
  });

  it('fails closed when fresh state cannot be read', async () => {
    const stub = createGovernanceRpcStub();
    const sign = signTx();

    await expect(
      executeProposal(16, SIGNER, sign, {
        ...governanceWriteOptions(stub),
        readProposal: async () => {
          throw new Error('offline');
        },
      })
    ).rejects.toMatchObject({ code: 'PROPOSAL_NOT_EXECUTABLE', resubmitSafe: true });

    expect(sign).not.toHaveBeenCalled();
  });

  it('continues when fresh state shows the proposal is executable', async () => {
    const stub = createGovernanceRpcStub();

    await expect(
      executeProposal(17, SIGNER, signTx(), {
        ...governanceWriteOptions(stub),
        readProposal: async () => ({ id: 17, status: 'Passed', executableAfter: 1 }),
      })
    ).resolves.toEqual(expect.any(String));
    expect(stub.sendTransaction).toHaveBeenCalledTimes(1);
  });
});
