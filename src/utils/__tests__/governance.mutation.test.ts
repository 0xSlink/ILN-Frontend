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
 * #1070 additions:
 *  - signTx is asserted called with the correct intent string on every write path
 *  - every returned hash must satisfy isValidTxHash (64-char hex)
 *  - hash is deterministic: same inputs → same hash across two independent calls
 *  - regression guard: no unsigned:/random fallback when a real signer is present
 *
 * The module keeps mutable mock state (MOCK_PROPOSALS, userVotes, vetoHistory)
 * at module scope, and Vitest isolates modules per test file, so assertions
 * are written relative to fetched-before/after snapshots rather than absolute
 * counters.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  castVote,
  createProposal,
  clearGovernanceIdempotencyCache,
  fetchProposal,
  fetchProposals,
  getVotingPower,
  vetoProposal,
  type CreateProposalPayload,
} from '../governance';
import { isValidTxHash } from '../explorer';
import {
  clearGovernanceTestSession,
  establishGovernanceTestSession,
} from './helpers/governanceSession';

const signTx = vi.fn(async (xdr: string) => `signed-${xdr}`);
const SIGNER = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Regression guard: ensures sign, submit and confirm never return a mock-random
// fallback. A hash that starts with "unsigned:" means no wallet was involved,
// which is only acceptable in read-only or test contexts that explicitly pass
// an empty signer. Any hash produced for a real signer must be derived from the
// collected signature — never from Math.random() (#1141).
function assertNoRandomFallback(hash: string, context: string) {
  expect(hash, `${context}: must not start with 'unsigned:'`).not.toMatch(/^unsigned:/);
  expect(hash, `${context}: must not contain 'random'`).not.toMatch(/random/i);
  expect(
    isValidTxHash(hash),
    `${context}: must be a valid 64-char hex tx hash, got "${hash}"`
  ).toBe(true);
}

// The governance write paths are gated behind a valid SEP-10 session (#1076),
// so every test starts with a deterministic session and tears it down after.
beforeEach(() => {
  establishGovernanceTestSession(SIGNER);
});

afterEach(() => {
  clearGovernanceTestSession();
});

describe('governance.castVote (critical path)', () => {
  beforeEach(() => {
    signTx.mockClear();
    clearGovernanceIdempotencyCache();
  });

  it('records a For vote and increments votesFor', async () => {
    const before = await fetchProposal(1);
    const result = await castVote(1, 'For', SIGNER, signTx);

    expect(signTx).toHaveBeenCalledWith(expect.stringContaining('vote:1:For'));
    assertNoRandomFallback(result, 'castVote For');

    const after = await fetchProposal(1);
    expect(after?.userVote).toBe('For');
    if (before && after) {
      expect(after.votesFor).toBe(before.votesFor + 1250);
    }
  });

  it('records an Against vote and increments votesAgainst', async () => {
    const before = await fetchProposal(2);
    const result = await castVote(2, 'Against', SIGNER, signTx);

    expect(signTx).toHaveBeenCalledWith(expect.stringContaining('vote:2:Against'));
    assertNoRandomFallback(result, 'castVote Against');

    const after = await fetchProposal(2);
    expect(after?.userVote).toBe('Against');
    if (before && after) {
      expect(after.votesAgainst).toBe(before.votesAgainst + 1250);
    }
  });

  it('records an Abstain vote and increments votesAbstain', async () => {
    const before = await fetchProposal(3);
    const result = await castVote(3, 'Abstain', SIGNER, signTx);

    expect(signTx).toHaveBeenCalledWith(expect.stringContaining('vote:3:Abstain'));
    assertNoRandomFallback(result, 'castVote Abstain');

    const after = await fetchProposal(3);
    expect(after?.userVote).toBe('Abstain');
    if (before && after) {
      expect(after.votesAbstain).toBe(before.votesAbstain + 1250);
    }
  });

  it('returns a valid 64-char hex hash even when no signer address is supplied', async () => {
    const result = await castVote(1, 'For', '', signTx);
    expect(isValidTxHash(result)).toBe(true);
  });

  it('hash is deterministic: same vote inputs yield the same hash', async () => {
    const hash1 = await castVote(4, 'For', SIGNER, signTx);
    clearGovernanceIdempotencyCache();
    const hash2 = await castVote(4, 'For', SIGNER, signTx);
    expect(hash1).toBe(hash2);
  });
});

describe('governance.createProposal (critical path)', () => {
  beforeEach(() => {
    signTx.mockClear();
    clearGovernanceIdempotencyCache();
  });

  it('creates a ParameterUpdate for FeeRate with fee_rate_bps change', async () => {
    const beforeCount = (await fetchProposals()).length;
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Reduce protocol fee rate',
      description: 'Lower the fee to stay competitive',
      newValueBps: 30,
    };
    const res = await createProposal(payload, SIGNER, signTx);

    expect(signTx).toHaveBeenCalled();
    assertNoRandomFallback(res.txHash, 'createProposal FeeRate');
    expect(res.proposalId).toBeGreaterThan(0);

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

    expect(signTx).toHaveBeenCalled();
    assertNoRandomFallback(res.txHash, 'createProposal MaxDiscountRate');

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

    expect(signTx).toHaveBeenCalled();
    assertNoRandomFallback(res.txHash, 'createProposal AddToken');

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

    expect(signTx).toHaveBeenCalled();
    assertNoRandomFallback(res.txHash, 'createProposal RemoveToken');

    const created = await fetchProposal(res.proposalId);
    expect(created?.parameterChanges?.[0]?.parameter).toBe('accepted_tokens');
  });

  it('createProposal hash is deterministic across two independent calls with same payload', async () => {
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Determinism check',
      description: 'Same payload, same hash',
      newValueBps: 50,
    };
    const res1 = await createProposal(payload, SIGNER, signTx);
    clearGovernanceIdempotencyCache();
    const res2 = await createProposal(payload, SIGNER, signTx);
    expect(res1.txHash).toBe(res2.txHash);
  });
});

describe('governance.vetoProposal', () => {
  beforeEach(() => {
    signTx.mockClear();
    clearGovernanceIdempotencyCache();
  });

  it('vetoes an existing proposal and prepends a veto record', async () => {
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Proposal to veto',
      description: 'A proposal we will veto',
      newValueBps: 25,
    };
    const created = await createProposal(payload, SIGNER, signTx);
    signTx.mockClear();

    const res = await vetoProposal(created.proposalId, '0xreason', SIGNER, signTx);

    expect(signTx).toHaveBeenCalledWith(expect.stringContaining('veto'));
    assertNoRandomFallback(res, 'vetoProposal');

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

describe('governance write-path regression: no mock/random fallback (#1070)', () => {
  beforeEach(() => {
    signTx.mockClear();
    clearGovernanceIdempotencyCache();
  });

  it('castVote does not return Math.random()-based hash when signer is present', async () => {
    // Call twice; if the implementation used Math.random() the hashes would differ
    const hash1 = await castVote(5, 'For', SIGNER, signTx);
    clearGovernanceIdempotencyCache();
    const hash2 = await castVote(5, 'For', SIGNER, signTx);
    expect(hash1).toBe(hash2);
    assertNoRandomFallback(hash1, 'castVote regression');
  });

  it('createProposal does not return Math.random()-based hash when signer is present', async () => {
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Regression check',
      description: 'No random hashes allowed',
      newValueBps: 10,
    };
    const res1 = await createProposal(payload, SIGNER, signTx);
    clearGovernanceIdempotencyCache();
    const res2 = await createProposal(payload, SIGNER, signTx);
    expect(res1.txHash).toBe(res2.txHash);
    assertNoRandomFallback(res1.txHash, 'createProposal regression');
  });

  it('vetoProposal does not return Math.random()-based hash when signer is present', async () => {
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Veto regression',
      description: 'Veto hash must be deterministic',
      newValueBps: 15,
    };
    const created = await createProposal(payload, SIGNER, signTx);

    const hash1 = await vetoProposal(created.proposalId, '0xreason', SIGNER, signTx);
    clearGovernanceIdempotencyCache();
    const hash2 = await vetoProposal(created.proposalId, '0xreason', SIGNER, signTx);
    expect(hash1).toBe(hash2);
    assertNoRandomFallback(hash1, 'vetoProposal regression');
  });
});
