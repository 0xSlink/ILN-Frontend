import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  castVote,
  createProposal,
  executeProposal,
  vetoProposal,
  fetchProposal,
  clearGovernanceIdempotencyCache,
  type CreateProposalPayload,
} from '../governance';
import { isValidTxHash } from '../explorer';
import {
  clearGovernanceTestSession,
  establishGovernanceTestSession,
} from './helpers/governanceSession';

const signTx = vi.fn(async (xdr: string) => `signed-${xdr}`);
const SIGNER = 'GBZXN7PIRZGNMHGA728RGRTDGBLTYNGHXMH2Y7QGE2FMQ3GVFCYX2O64';

// Governance writes require a valid SEP-10 session (#1076).
beforeEach(() => {
  establishGovernanceTestSession(SIGNER);
});

afterEach(() => {
  clearGovernanceTestSession();
});

describe('governance idempotency and valid transaction hashes (#1146, #1148)', () => {
  beforeEach(() => {
    clearGovernanceIdempotencyCache();
    vi.clearAllMocks();
  });

  describe('castVote idempotency', () => {
    it('returns a valid 64-character hex transaction hash', async () => {
      const hash = await castVote(1, 'For', SIGNER, signTx);
      expect(isValidTxHash(hash)).toBe(true);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns the same txHash and does not double-count votes on retry with identical choice', async () => {
      const payload: CreateProposalPayload = {
        formType: 'FeeRate',
        title: 'Proposal for voting idempotency',
        description: 'Testing vote deduplication',
        newValueBps: 10,
      };
      const created = await createProposal(payload, SIGNER, signTx);
      const initialProposal = await fetchProposal(created.proposalId);
      const initialVotesFor = initialProposal?.votesFor ?? 0;

      const firstHash = await castVote(created.proposalId, 'For', SIGNER, signTx);
      const afterFirstProposal = await fetchProposal(created.proposalId);
      const votesAfterFirst = afterFirstProposal?.votesFor ?? 0;
      expect(votesAfterFirst).toBe(initialVotesFor + 1250);

      // Retry voting with the same choice (e.g. user retrying a lagged UI action)
      const secondHash = await castVote(created.proposalId, 'For', SIGNER, signTx);
      const afterSecondProposal = await fetchProposal(created.proposalId);

      expect(secondHash).toBe(firstHash);
      expect(afterSecondProposal?.votesFor).toBe(votesAfterFirst); // Must not increment again
    });

    it('adjusts tally cleanly if voter switches choice', async () => {
      await castVote(2, 'For', SIGNER, signTx);
      const forProposal = await fetchProposal(2);
      const votesFor = forProposal?.votesFor ?? 0;
      const votesAgainst = forProposal?.votesAgainst ?? 0;

      // Switch vote from For to Against
      await castVote(2, 'Against', SIGNER, signTx);
      const againstProposal = await fetchProposal(2);

      expect(againstProposal?.userVote).toBe('Against');
      expect(againstProposal?.votesFor).toBe(Math.max(0, votesFor - 1250));
      expect(againstProposal?.votesAgainst).toBe(votesAgainst + 1250);
    });
  });

  describe('executeProposal idempotency', () => {
    it('returns a valid 64-char hash and preserves confirmation on duplicate execution', async () => {
      const payload: CreateProposalPayload = {
        formType: 'FeeRate',
        title: 'Proposal for execution idempotency',
        description: 'Testing execute deduplication',
        newValueBps: 15,
      };
      const created = await createProposal(payload, SIGNER, signTx);

      const firstHash = await executeProposal(created.proposalId, SIGNER, signTx);
      expect(isValidTxHash(firstHash)).toBe(true);

      const executedProposal = await fetchProposal(created.proposalId);
      expect(executedProposal?.status).toBe('Executed');

      // Duplicate execution attempt
      const secondHash = await executeProposal(created.proposalId, SIGNER, signTx);
      expect(secondHash).toBe(firstHash);
    });
  });

  describe('vetoProposal idempotency', () => {
    it('returns a valid 64-char hash and returns existing confirmation on duplicate veto', async () => {
      const payload: CreateProposalPayload = {
        formType: 'FeeRate',
        title: 'Proposal for veto idempotency',
        description: 'Testing veto deduplication',
        newValueBps: 20,
      };
      const created = await createProposal(payload, SIGNER, signTx);

      const reasonHash = '0xidempotent_reason_hash';
      const firstHash = await vetoProposal(created.proposalId, reasonHash, SIGNER, signTx);
      expect(isValidTxHash(firstHash)).toBe(true);

      const secondHash = await vetoProposal(created.proposalId, reasonHash, SIGNER, signTx);
      expect(secondHash).toBe(firstHash);
    });
  });

  describe('createProposal idempotency', () => {
    it('deduplicates rapid duplicate proposal submissions with identical payload', async () => {
      const payload: CreateProposalPayload = {
        formType: 'MaxDiscountRate',
        title: 'Deduplicated discount proposal',
        description: 'Testing deduplication',
        newValueBps: 500,
      };

      const firstRes = await createProposal(payload, SIGNER, signTx);
      expect(isValidTxHash(firstRes.txHash)).toBe(true);

      // Immediate second submission
      const secondRes = await createProposal(payload, SIGNER, signTx);
      expect(secondRes.proposalId).toBe(firstRes.proposalId);
      expect(secondRes.txHash).toBe(firstRes.txHash);
    });
  });
});
