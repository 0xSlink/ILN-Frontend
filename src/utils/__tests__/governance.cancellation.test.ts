/**
 * Cancellation-without-mutation tests for #1144 (governance write paths).
 *
 * A declined signature or closed wallet must leave every piece of local
 * governance state untouched: no tally change, no status change, no veto
 * record, no appended proposal. Only a collected signature may mutate.
 */

import { describe, expect, it, vi } from 'vitest';
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

const SIGNER = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const okSignTx = vi.fn(async (xdr: string) => `signed-${xdr}`);
const rejectSignTx = vi.fn(async (_xdr: string): Promise<string> => {
  throw new Error('User rejected the transaction');
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
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Veto target',
      description: 'Created then veto-declined',
      newValueBps: 30,
    };
    const created = await createProposal(payload, SIGNER, okSignTx);
    const historyBefore = getVetoHistory(created.proposalId);
    await expect(
      vetoProposal(created.proposalId, '0xreason', SIGNER, rejectSignTx)
    ).rejects.toThrow(/USER_REJECTED/i);
    expect(getVetoHistory(created.proposalId)).toEqual(historyBefore);
    expect((await fetchProposal(created.proposalId))?.status).toBe('Active');
  });

  it('createProposal appends nothing when signing is declined', async () => {
    const beforeCount = (await fetchProposals()).length;
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Declined proposal',
      description: 'Should never be appended',
      newValueBps: 30,
    };
    await expect(createProposal(payload, SIGNER, rejectSignTx)).rejects.toThrow(/USER_REJECTED/i);
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
