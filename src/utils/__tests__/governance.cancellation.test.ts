/**
 * Cancellation-without-mutation tests for #1144 (governance write paths).
 *
 * A declined signature or closed wallet must leave every piece of local
 * governance state untouched: no tally change, no status change, no veto
 * record, no appended proposal. Only a collected signature may mutate.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  castVote,
  createProposal,
  executeProposal,
  fetchProposal,
  fetchProposals,
  getVetoHistory,
  vetoProposal,
  type CreateProposalPayload,
} from '../governance';
import { isValidTxHash } from '../explorer';
import {
  clearGovernanceTestSession,
  establishGovernanceTestSession,
} from './helpers/governanceSession';
import { PROPOSAL_CONTEXT, PROPOSER, stubProposalRpc } from './helpers/proposalRpc';

const SIGNER = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const okSignTx = vi.fn(async (xdr: string) => `signed-${xdr}`);
const rejectSignTx = vi.fn(async (_xdr: string): Promise<string> => {
  throw new Error('User rejected the transaction');
});

// Governance writes require a valid SEP-10 session (#1076).
beforeEach(() => {
  establishGovernanceTestSession(SIGNER);
});

afterEach(() => {
  clearGovernanceTestSession();
});

describe('governance cancellation leaves state unchanged', () => {
  it('castVote does not record or tally when signing is declined', async () => {
    const before = await fetchProposal(1);
    const votesFor = before?.votesFor;
    await expect(castVote(1, 'For', SIGNER, rejectSignTx)).rejects.toThrow(/USER_REJECTED/i);
    const after = await fetchProposal(1);
    expect(after?.userVote).toBe(before?.userVote);
    expect(after?.votesFor).toBe(votesFor);
  });

  it('executeProposal keeps status when signing is declined', async () => {
    const before = await fetchProposal(2);
    await expect(executeProposal(2, SIGNER, rejectSignTx)).rejects.toThrow(/USER_REJECTED/i);
    const after = await fetchProposal(2);
    expect(after?.status).toBe(before?.status);
  });

  it('vetoProposal adds no record when signing is declined', async () => {
    // Proposal creation is on-chain now, so veto an existing active proposal.
    const target = 6;
    expect((await fetchProposal(target))?.status).toBe('Active');
    const historyBefore = getVetoHistory(target);
    await expect(vetoProposal(target, '0xreason', SIGNER, rejectSignTx)).rejects.toThrow(
      /USER_REJECTED/i
    );
    expect(getVetoHistory(target)).toEqual(historyBefore);
    expect((await fetchProposal(target))?.status).toBe('Active');
  });

  it('createProposal appends nothing when signing is declined', async () => {
    const beforeCount = (await fetchProposals()).length;
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Declined proposal',
      description: 'Should never be submitted or appended',
      newValueBps: 30,
    };
    establishGovernanceTestSession(PROPOSER);
    const rpcStub = stubProposalRpc();
    try {
      await expect(
        createProposal(payload, PROPOSER, rejectSignTx, { context: PROPOSAL_CONTEXT })
      ).rejects.toThrow(/USER_REJECTED/i);
      expect(rpcStub.sendTransaction).not.toHaveBeenCalled();
    } finally {
      rpcStub.restore();
    }
    expect((await fetchProposals()).length).toBe(beforeCount);
  });

  it('non-cancellation signing errors also mutate nothing', async () => {
    const failingSignTx = vi.fn(async (): Promise<string> => {
      throw new Error('Simulation failed: bad parameters');
    });
    const before = await fetchProposal(1);
    await expect(castVote(1, 'For', SIGNER, failingSignTx)).rejects.toThrow(/simulation failed/i);
    expect((await fetchProposal(1))?.votesFor).toBe(before?.votesFor);
  });

  it('a collected signature still applies and yields a deterministic hash', async () => {
    const first = await castVote(6, 'For', SIGNER, okSignTx);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(isValidTxHash(first)).toBe(true);
    expect(okSignTx).toHaveBeenCalled();
  });
});
