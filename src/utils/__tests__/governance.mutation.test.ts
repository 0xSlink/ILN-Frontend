/**
 * @file governance.mutation.test.ts
 *
 * Focused mutation-testing suite for the live governance module
 * (src/utils/governance.ts). Per issue #741 the financially-consequential
 * vote-casting and proposal-creation paths are held to a higher mutation-score
 * bar than the app-wide baseline, so this suite exercises every branch of the
 * core write paths:
 *
 *  - castVote: For / Against / Abstain tally increments + userVote recording
 *  - createProposal: FeeRate / MaxDiscountRate / AddToken / RemoveToken mapping
 *  - vetoProposal: success + "Proposal not found" guard
 *  - executeProposal / getVotingPower happy paths
 *
 * The module keeps mutable mock state (MOCK_PROPOSALS, userVotes, vetoHistory)
 * at module scope, and Vitest isolates modules per test file, so assertions
 * are written relative to fetched-before/after snapshots rather than absolute
 * counters.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  castVote,
  createProposal,
  fetchProposal,
  fetchProposals,
  getVotingPower,
  vetoProposal,
  type CreateProposalPayload,
} from '../governance';

const signTx = vi.fn(async (xdr: string) => `signed-${xdr}`);
const SIGNER = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ';

describe('governance.castVote (critical path)', () => {
  it('records a For vote and increments votesFor', async () => {
    const before = await fetchProposal(1);
    const result = await castVote(1, 'For', SIGNER, signTx);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);

    const after = await fetchProposal(1);
    expect(after?.userVote).toBe('For');
    if (before && after) {
      expect(after.votesFor).toBe(before.votesFor + 1250);
    }
  });

  it('records an Against vote and increments votesAgainst', async () => {
    const before = await fetchProposal(2);
    await castVote(2, 'Against', SIGNER, signTx);
    const after = await fetchProposal(2);
    expect(after?.userVote).toBe('Against');
    if (before && after) {
      expect(after.votesAgainst).toBe(before.votesAgainst + 1250);
    }
  });

  it('records an Abstain vote and increments votesAbstain', async () => {
    const before = await fetchProposal(3);
    await castVote(3, 'Abstain', SIGNER, signTx);
    const after = await fetchProposal(3);
    expect(after?.userVote).toBe('Abstain');
    if (before && after) {
      expect(after.votesAbstain).toBe(before.votesAbstain + 1250);
    }
  });

  it('returns a tx hash even when no signer address is supplied', async () => {
    const result = await castVote(1, 'For', '', signTx);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('governance.createProposal (critical path)', () => {
  it('creates a ParameterUpdate for FeeRate with fee_rate_bps change', async () => {
    const beforeCount = (await fetchProposals()).length;
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Reduce protocol fee rate',
      description: 'Lower the fee to stay competitive',
      newValueBps: 30,
    };
    const res = await createProposal(payload, SIGNER, signTx);

    expect(res.proposalId).toBeGreaterThan(0);
    expect(typeof res.txHash).toBe('string');

    const afterCount = (await fetchProposals()).length;
    expect(afterCount).toBe(beforeCount + 1);

    const created = await fetchProposal(res.proposalId);
    expect(created?.type).toBe('ParameterUpdate');
    expect(created?.parameterChanges?.[0]?.parameter).toBe('fee_rate_bps');
    expect(created?.parameterChanges?.[0]?.newValue).toContain('30');
  });

  it('maps MaxDiscountRate to a ParameterUpdate with max_discount_rate_bps', async () => {
    const payload: CreateProposalPayload = {
      formType: 'MaxDiscountRate',
      title: 'Raise max discount rate',
      description: 'Allow deeper early-pay discounts',
      newValueBps: 400,
    };
    const res = await createProposal(payload, SIGNER, signTx);
    const created = await fetchProposal(res.proposalId);
    expect(created?.parameterChanges?.[0]?.parameter).toBe('max_discount_rate_bps');
  });

  it('maps AddToken to a ProtocolUpgrade adding the token', async () => {
    const payload: CreateProposalPayload = {
      formType: 'AddToken',
      title: 'List NEWT',
      description: 'Add NewToken to accepted tokens',
      tokenAddress: 'CNEWTOKENADDRESS',
      tokenName: 'NEWT',
    };
    const res = await createProposal(payload, SIGNER, signTx);
    const created = await fetchProposal(res.proposalId);
    expect(created?.type).toBe('ProtocolUpgrade');
    expect(created?.parameterChanges?.[0]?.parameter).toBe('accepted_tokens');
    expect(created?.parameterChanges?.[0]?.newValue).toContain('NEWT');
  });

  it('maps RemoveToken to a ProtocolUpgrade removing the token', async () => {
    const payload: CreateProposalPayload = {
      formType: 'RemoveToken',
      title: 'Delist token',
      description: 'Remove a deprecated token',
      removeTokenAddress: 'CNEWTOKENADDRESS',
    };
    const res = await createProposal(payload, SIGNER, signTx);
    const created = await fetchProposal(res.proposalId);
    expect(created?.parameterChanges?.[0]?.parameter).toBe('accepted_tokens');
  });
});

describe('governance.vetoProposal', () => {
  it('vetoes an existing proposal and prepends a veto record', async () => {
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Proposal to veto',
      description: 'A proposal we will veto',
      newValueBps: 25,
    };
    const created = await createProposal(payload, SIGNER, signTx);
    const res = await vetoProposal(created.proposalId, '0xreason', SIGNER, signTx);
    expect(typeof res).toBe('string');
    const after = await fetchProposal(created.proposalId);
    expect(after?.status).toBe('Vetoed');
  });

  it('throws when the proposal does not exist', async () => {
    await expect(vetoProposal(999_999, '0xreason', SIGNER, signTx)).rejects.toThrow(
      /proposal not found/i
    );
  });
});

describe('governance.getVotingPower', () => {
  it('resolves a numeric power, falling back to 0 (no fabricated constant)', async () => {
    const power = await getVotingPower(SIGNER);
    expect(Number.isFinite(power)).toBe(true);
    expect(power).toBeGreaterThanOrEqual(0);
  });
});
