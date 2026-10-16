/**
 * Extended governance tests for previously uncovered functions:
 * - executeProposal, vetoProposal, getVetoHistory
 * - getDelegationInfo (all branches)
 * - lookupToken (all branches)
 * - createProposal (MaxDiscountRate, RemoveToken paths)
 * - fetchParameterUpdates
 * - fetchVotesForAddress
 * - timeRemaining (active proposal paths: days+hours, hours+mins, "Ended")
 * - getUserVote
 * - MOCK_PROPOSALS / MOCK_VOTES data
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  executeProposal,
  vetoProposal,
  getVetoHistory,
  getDelegationInfo,
  lookupToken,
  createProposal,
  fetchParameterUpdates,
  fetchVotesForAddress,
  fetchProposals,
  fetchProtocolParameters,
  castVote,
  timeRemaining,
  getUserVote,
  MOCK_PROPOSALS,
  MOCK_VOTES,
  type CreateProposalPayload,
  type Proposal,
} from '@/utils/governance';

const SIGNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const mockSignTx = vi.fn(async (_xdr: string) => 'signedXDR');

afterEach(() => {
  vi.useRealTimers();
});

describe('governance – executeProposal', () => {
  it('returns a transaction hash and sets status to Executed', async () => {
    vi.useFakeTimers();
    const proposalId = 6;
    const promise = executeProposal(proposalId, SIGNER, mockSignTx);
    vi.runAllTimers();
    const hash = await promise;
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
    const proposal = MOCK_PROPOSALS.find((p) => p.id === proposalId);
    expect(proposal?.status).toBe('Executed');
  });

  it('handles non-existent proposal gracefully', async () => {
    vi.useFakeTimers();
    const promise = executeProposal(9999, SIGNER, mockSignTx);
    vi.runAllTimers();
    const hash = await promise;
    expect(typeof hash).toBe('string');
  });
});

describe('governance – vetoProposal', () => {
  it('sets proposal status to Vetoed and records veto history', async () => {
    vi.useFakeTimers();
    const proposalId = 1;
    const reasonHash = 'abc123reasonhash';
    const adminAddress = 'GADMIN_ADDRESS';
    const promise = vetoProposal(proposalId, reasonHash, adminAddress, mockSignTx);
    vi.runAllTimers();
    const hash = await promise;

    expect(typeof hash).toBe('string');
    const proposal = MOCK_PROPOSALS.find((p) => p.id === proposalId);
    expect(proposal?.status).toBe('Vetoed');
    expect(proposal?.vetoHistory).toBeDefined();
    expect(proposal!.vetoHistory!.length).toBeGreaterThan(0);
    expect(proposal!.vetoHistory![0].admin).toBe(adminAddress);
    expect(proposal!.vetoHistory![0].reasonHash).toBe(reasonHash);
  });

  it('throws for non-existent proposal', async () => {
    vi.useFakeTimers();
    const promise = vetoProposal(99999, 'reason', 'GADMIN', mockSignTx);
    vi.runAllTimers();
    await expect(promise).rejects.toThrow('Proposal not found');
  });
});

describe('governance – getVetoHistory', () => {
  it('returns veto records for a given proposal', () => {
    // The veto from the previous test should be here
    const history = getVetoHistory(1);
    expect(Array.isArray(history)).toBe(true);
  });

  it('returns empty array for proposals with no vetoes', () => {
    const history = getVetoHistory(9999);
    expect(history).toEqual([]);
  });
});

describe('governance – getDelegationInfo', () => {
  it('returns delegation data for known address GABC123', async () => {
    vi.useFakeTimers();
    const promise = getDelegationInfo('GABC123');
    vi.runAllTimers();
    const info = await promise;

    expect(info.delegatedTo).toBe('GDEF456EXAMPLE789ABC012GHI345JKL678MNO901PQR234STU567VWX890YZ');
    expect(info.delegatedAmount).toBe(500);
    expect(info.incomingDelegations).toBe(0);
  });

  it('returns delegation data for known address GDEF456', async () => {
    vi.useFakeTimers();
    const promise = getDelegationInfo('GDEF456');
    vi.runAllTimers();
    const info = await promise;

    expect(info.delegatedTo).toBeNull();
    expect(info.delegatedAmount).toBe(0);
    expect(info.incomingDelegations).toBe(1200);
  });

  it('returns default delegation for unknown address', async () => {
    vi.useFakeTimers();
    const promise = getDelegationInfo('GUNKNOWN_ADDRESS_EXAMPLE');
    vi.runAllTimers();
    const info = await promise;

    expect(info.delegatedTo).toBeNull();
    expect(info.delegatedAmount).toBe(0);
    expect(typeof info.incomingDelegations).toBe('number');
  });
});

describe('governance – lookupToken', () => {
  it('rejects invalid Stellar address', async () => {
    await expect(lookupToken('invalid-address')).rejects.toThrow('Invalid Stellar address');
  });

  it('rejects empty string', async () => {
    await expect(lookupToken('')).rejects.toThrow('Invalid Stellar address');
  });

  it('rejects address that does not start with G', async () => {
    await expect(
      lookupToken('CABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCD')
    ).rejects.toThrow('Invalid Stellar address');
  });

  it('returns Unknown Token for valid G-address not in known set', async () => {
    vi.useFakeTimers();
    // Valid G-address (G + 55 base32 chars) not in accepted or known tokens
    const promise = lookupToken('GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBVN');
    vi.runAllTimers();
    const token = await promise;
    expect(token.name).toBe('Unknown Token');
  });

  it('returns Unknown Token with truncated symbol for unknown valid G-address', async () => {
    vi.useFakeTimers();
    const promise = lookupToken('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
    vi.runAllTimers();
    const token = await promise;
    expect(token.symbol).toBe('GAAA');
    expect(token.name).toBe('Unknown Token');
  });

  it('rejects C-prefixed token contract addresses as invalid', async () => {
    // Token contract IDs on Stellar start with C, not G
    // lookupToken validates for G-prefix, so C-prefixed addresses are rejected
    await expect(
      lookupToken('CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75')
    ).rejects.toThrow('Invalid Stellar address');
  });
});

describe('governance – createProposal extended paths', () => {
  it('creates a MaxDiscountRate proposal', async () => {
    vi.useFakeTimers();
    const payload: CreateProposalPayload = {
      formType: 'MaxDiscountRate',
      title: 'Lower max discount',
      description: 'Reduce max discount rate to 4%',
      newValueBps: 400,
    };
    const promise = createProposal(payload, SIGNER, mockSignTx);
    vi.runAllTimers();
    const result = await promise;

    expect(result.proposalId).toBeGreaterThan(0);
    const created = MOCK_PROPOSALS.find((p) => p.id === result.proposalId);
    expect(created?.parameterChanges).toBeDefined();
    expect(created?.parameterChanges?.[0].parameter).toBe('max_discount_rate_bps');
  });

  it('creates a RemoveToken proposal', async () => {
    vi.useFakeTimers();
    const payload: CreateProposalPayload = {
      formType: 'RemoveToken',
      title: 'Remove EURC',
      description: 'Remove EURC from accepted tokens',
      removeTokenAddress: 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV',
    };
    const promise = createProposal(payload, SIGNER, mockSignTx);
    vi.runAllTimers();
    const result = await promise;

    expect(result.proposalId).toBeGreaterThan(0);
    const created = MOCK_PROPOSALS.find((p) => p.id === result.proposalId);
    expect(created?.parameterChanges).toBeDefined();
    expect(created?.parameterChanges?.[0].parameter).toBe('accepted_tokens');
    expect(created?.parameterChanges?.[0].newValue).toContain('removes EURC');
  });

  it('creates a RemoveToken proposal for non-existing token', async () => {
    vi.useFakeTimers();
    const payload: CreateProposalPayload = {
      formType: 'RemoveToken',
      title: 'Remove Unknown',
      description: 'Remove token not in list',
      removeTokenAddress: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };
    const promise = createProposal(payload, SIGNER, mockSignTx);
    vi.runAllTimers();
    const result = await promise;

    const created = MOCK_PROPOSALS.find((p) => p.id === result.proposalId);
    expect(created?.parameterChanges?.[0].newValue).not.toContain('removes');
  });
});

describe('governance – fetchParameterUpdates', () => {
  it('returns parameter updates from executed proposals', async () => {
    vi.useFakeTimers();
    const promise = fetchParameterUpdates();
    vi.runAllTimers();
    const updates = await promise;

    expect(Array.isArray(updates)).toBe(true);
    // Should contain updates from executed proposals (4, 7)
    for (const update of updates) {
      expect(update).toHaveProperty('id');
      expect(update).toHaveProperty('proposalId');
      expect(update).toHaveProperty('parameter');
      expect(update).toHaveProperty('label');
      expect(update).toHaveProperty('newValue');
      expect(update).toHaveProperty('updatedAt');
    }
  });

  it('updates are sorted newest first', async () => {
    vi.useFakeTimers();
    const promise = fetchParameterUpdates();
    vi.runAllTimers();
    const updates = await promise;

    for (let i = 1; i < updates.length; i++) {
      expect(updates[i - 1].updatedAt).toBeGreaterThanOrEqual(updates[i].updatedAt);
    }
  });
});

describe('governance – fetchVotesForAddress', () => {
  it('returns votes for known mock voter', async () => {
    vi.useFakeTimers();
    const promise = fetchVotesForAddress(
      'GABC123EXAMPLE456789ABC012GHI345JKL678MNO901PQR234STU567VWX890YZ'
    );
    vi.runAllTimers();
    const votes = await promise;

    expect(Array.isArray(votes)).toBe(true);
    expect(votes.length).toBeGreaterThan(0);
    // Should be sorted by timestamp descending
    for (let i = 1; i < votes.length; i++) {
      expect(votes[i - 1].timestamp).toBeGreaterThanOrEqual(votes[i].timestamp);
    }
  });

  it('returns empty array for unknown address', async () => {
    vi.useFakeTimers();
    const promise = fetchVotesForAddress('GUNKNOWN_ADDRESS');
    vi.runAllTimers();
    const votes = await promise;
    expect(votes).toEqual([]);
  });
});

describe('governance – timeRemaining active paths', () => {
  it("returns 'Ended' for active proposal with past end time", () => {
    const now = Math.floor(Date.now() / 1000);
    const proposal: Proposal = {
      id: 100,
      title: 'Test',
      description: 'Test',
      type: 'ParameterUpdate',
      status: 'Active',
      proposer: 'G...',
      createdAt: now - 86400 * 10,
      votingStartsAt: now - 86400 * 10,
      votingEndsAt: now - 1, // ended 1 second ago
      votesFor: 0,
      votesAgainst: 0,
      votesAbstain: 0,
      quorumRequired: 100_000,
    };
    expect(timeRemaining(proposal)).toBe('Ended');
  });

  it('returns days and hours for active proposal with >1 day remaining', () => {
    const now = Math.floor(Date.now() / 1000);
    const proposal: Proposal = {
      id: 101,
      title: 'Test',
      description: 'Test',
      type: 'ParameterUpdate',
      status: 'Active',
      proposer: 'G...',
      createdAt: now - 86400,
      votingStartsAt: now - 86400,
      votingEndsAt: now + 86400 * 3 + 3600 * 5, // 3 days 5 hours from now
      votesFor: 0,
      votesAgainst: 0,
      votesAbstain: 0,
      quorumRequired: 100_000,
    };
    const result = timeRemaining(proposal);
    expect(result).toMatch(/\d+d \d+h remaining/);
  });

  it('returns hours and minutes for active proposal with <1 day remaining', () => {
    const now = Math.floor(Date.now() / 1000);
    const proposal: Proposal = {
      id: 102,
      title: 'Test',
      description: 'Test',
      type: 'ParameterUpdate',
      status: 'Active',
      proposer: 'G...',
      createdAt: now - 86400,
      votingStartsAt: now - 86400,
      votingEndsAt: now + 3600 * 5 + 60 * 30, // 5 hours 30 minutes from now
      votesFor: 0,
      votesAgainst: 0,
      votesAbstain: 0,
      quorumRequired: 100_000,
    };
    const result = timeRemaining(proposal);
    expect(result).toMatch(/\d+h \d+m remaining/);
  });

  it('returns empty string for Failed proposals', () => {
    const now = Math.floor(Date.now() / 1000);
    const proposal: Proposal = {
      id: 103,
      title: 'Test',
      description: 'Test',
      type: 'ParameterUpdate',
      status: 'Failed',
      proposer: 'G...',
      createdAt: now - 86400,
      votingStartsAt: now - 86400,
      votingEndsAt: now + 86400,
      votesFor: 0,
      votesAgainst: 0,
      votesAbstain: 0,
      quorumRequired: 100_000,
    };
    expect(timeRemaining(proposal)).toBe('');
  });
});

describe('governance – getUserVote', () => {
  it('returns undefined for proposals not voted on', () => {
    expect(getUserVote(99999)).toBeUndefined();
  });

  it('returns the vote choice after casting', async () => {
    vi.useFakeTimers();
    const promise = castVote(5, 'Abstain', SIGNER, mockSignTx);
    vi.runAllTimers();
    await promise;
    expect(getUserVote(5)).toBe('Abstain');
  });
});

describe('governance – MOCK_VOTES', () => {
  it('contains vote cast events with required fields', () => {
    expect(Array.isArray(MOCK_VOTES)).toBe(true);
    for (const vote of MOCK_VOTES) {
      expect(vote).toHaveProperty('proposalId');
      expect(vote).toHaveProperty('proposalTitle');
      expect(vote).toHaveProperty('voter');
      expect(vote).toHaveProperty('vote');
      expect(vote).toHaveProperty('weight');
      expect(vote).toHaveProperty('timestamp');
    }
  });
});

describe('governance – fetchProtocolParameters values', () => {
  it('returns correct fee rate', async () => {
    vi.useFakeTimers();
    const promise = fetchProtocolParameters();
    vi.runAllTimers();
    const params = await promise;
    vi.useRealTimers();
    expect(params.feeRateBps).toBe(50);
  });

  it('returns correct max discount rate', async () => {
    vi.useFakeTimers();
    const promise = fetchProtocolParameters();
    vi.runAllTimers();
    const params = await promise;
    vi.useRealTimers();
    expect(params.maxDiscountRateBps).toBe(500);
  });

  it('returns accepted tokens with USDC and EURC', async () => {
    vi.useFakeTimers();
    const promise = fetchProtocolParameters();
    vi.runAllTimers();
    const params = await promise;
    vi.useRealTimers();
    const symbols = params.acceptedTokens.map((t) => t.symbol);
    expect(symbols).toContain('USDC');
    expect(symbols).toContain('EURC');
  });

  it('returns correct min proposal ILN', async () => {
    vi.useFakeTimers();
    const promise = fetchProtocolParameters();
    vi.runAllTimers();
    const params = await promise;
    vi.useRealTimers();
    expect(params.minProposalILN).toBe(500);
  });
});

describe('governance – createProposal parameter change values', () => {
  it('FeeRate proposal includes correct current/new values', async () => {
    vi.useFakeTimers();
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Lower fee',
      description: 'Reduce fee',
      newValueBps: 30,
    };
    const promise = createProposal(payload, SIGNER, mockSignTx);
    vi.runAllTimers();
    const result = await promise;
    vi.useRealTimers();

    const created = MOCK_PROPOSALS.find((p) => p.id === result.proposalId);
    const change = created?.parameterChanges?.[0];
    expect(change?.parameter).toBe('fee_rate_bps');
    expect(change?.currentValue).toContain('50');
    expect(change?.newValue).toContain('30');
    expect(change?.newValue).toContain('0.3');
  });

  it('MaxDiscountRate proposal includes correct parameter name', async () => {
    vi.useFakeTimers();
    const payload: CreateProposalPayload = {
      formType: 'MaxDiscountRate',
      title: 'Lower discount',
      description: 'Reduce discount',
      newValueBps: 350,
    };
    const promise = createProposal(payload, SIGNER, mockSignTx);
    vi.runAllTimers();
    const result = await promise;
    vi.useRealTimers();

    const created = MOCK_PROPOSALS.find((p) => p.id === result.proposalId);
    expect(created?.parameterChanges?.[0].parameter).toBe('max_discount_rate_bps');
  });

  it('AddToken proposal includes token name in new value', async () => {
    vi.useFakeTimers();
    const payload: CreateProposalPayload = {
      formType: 'AddToken',
      title: 'Add wBTC',
      description: 'Add wrapped Bitcoin',
      tokenAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      tokenName: 'Wrapped Bitcoin',
    };
    const promise = createProposal(payload, SIGNER, mockSignTx);
    vi.runAllTimers();
    const result = await promise;
    vi.useRealTimers();

    const created = MOCK_PROPOSALS.find((p) => p.id === result.proposalId);
    expect(created?.parameterChanges?.[0].newValue).toContain('Wrapped Bitcoin');
  });
});

describe('governance – castVote / executeProposal tx-hash generation fallback', () => {
  it('castVote logs a warning and falls back to a random hash when hash generation throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const randomSpy = vi.spyOn(Math, 'random').mockImplementationOnce(() => {
      throw new Error('entropy source unavailable');
    });

    vi.useFakeTimers();
    const promise = castVote(4, 'For', SIGNER, mockSignTx);
    vi.runAllTimers();
    const hash = await promise;

    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledWith('On-chain vote recording fallback:', expect.any(Error));

    randomSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('executeProposal logs a warning and falls back to a random hash when hash generation throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const randomSpy = vi.spyOn(Math, 'random').mockImplementationOnce(() => {
      throw new Error('entropy source unavailable');
    });

    vi.useFakeTimers();
    const promise = executeProposal(7, SIGNER, mockSignTx);
    vi.runAllTimers();
    const hash = await promise;

    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledWith(
      'On-chain proposal execution fallback:',
      expect.any(Error)
    );

    randomSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe('governance – castVote / executeProposal branch edge cases', () => {
  it('castVote skips vote-tally update for a non-existent proposal but still returns a hash', async () => {
    vi.useFakeTimers();
    const promise = castVote(9999, 'For', SIGNER, mockSignTx);
    vi.runAllTimers();
    const hash = await promise;
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
    // No matching proposal exists, so nothing to assert on vote tallies —
    // the important behavior is that it doesn't throw and still returns a hash.
  });

  it('castVote skips the on-chain attempt entirely when signerAddress is empty', async () => {
    vi.useFakeTimers();
    const promise = castVote(1, 'For', '', mockSignTx);
    vi.runAllTimers();
    const hash = await promise;
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('executeProposal skips the on-chain attempt entirely when signerAddress is empty', async () => {
    vi.useFakeTimers();
    const promise = executeProposal(6, '', mockSignTx);
    vi.runAllTimers();
    const hash = await promise;
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});

describe('governance – createProposal fallback branches', () => {
  it('AddToken proposal falls back to a truncated address when tokenName is omitted', async () => {
    vi.useFakeTimers();
    const payload: CreateProposalPayload = {
      formType: 'AddToken',
      title: 'Add unnamed token',
      description: 'Add a token without providing a display name',
      tokenAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      // tokenName intentionally omitted
    };
    const promise = createProposal(payload, SIGNER, mockSignTx);
    vi.runAllTimers();
    const result = await promise;
    vi.useRealTimers();

    const created = MOCK_PROPOSALS.find((p) => p.id === result.proposalId);
    // Falls back to payload.tokenAddress.slice(0, 6) since tokenName is undefined
    expect(created?.parameterChanges?.[0].newValue).toContain('CDLZFC');
  });

  it('RemoveToken proposal without a removeTokenAddress produces no parameterChanges', async () => {
    vi.useFakeTimers();
    const payload: CreateProposalPayload = {
      formType: 'RemoveToken',
      title: 'Remove token (missing address)',
      description: 'RemoveToken form submitted without a target address',
      // removeTokenAddress intentionally omitted
    };
    const promise = createProposal(payload, SIGNER, mockSignTx);
    vi.runAllTimers();
    const result = await promise;
    vi.useRealTimers();

    const created = MOCK_PROPOSALS.find((p) => p.id === result.proposalId);
    expect(created?.parameterChanges).toBeUndefined();
  });
});

describe('governance – fetchParameterUpdates executableAfter fallback', () => {
  it('falls back to votingEndsAt as updatedAt when an executed proposal has no executableAfter', async () => {
    vi.useFakeTimers();

    // Create a fresh proposal (status Active, no executableAfter set anywhere
    // in the creation path) then execute it — executeProposal only flips
    // status to 'Executed', it never sets executableAfter.
    const createPromise = createProposal(
      {
        formType: 'FeeRate',
        title: 'Fallback updatedAt proposal',
        description: 'Exercises the executableAfter ?? votingEndsAt fallback',
        newValueBps: 40,
      },
      SIGNER,
      mockSignTx
    );
    vi.runAllTimers();
    const { proposalId } = await createPromise;

    const execPromise = executeProposal(proposalId, SIGNER, mockSignTx);
    vi.runAllTimers();
    await execPromise;

    const updatesPromise = fetchParameterUpdates();
    vi.runAllTimers();
    const updates = await updatesPromise;
    vi.useRealTimers();

    const created = MOCK_PROPOSALS.find((p) => p.id === proposalId)!;
    const update = updates.find((u) => u.proposalId === proposalId);
    expect(update).toBeDefined();
    expect(created.executableAfter).toBeUndefined();
    expect(update!.updatedAt).toBe(created.votingEndsAt);
  });
});

describe('governance – fetchProposals session state', () => {
  it('includes userVote from session state', async () => {
    vi.useFakeTimers();
    const votePromise = castVote(3, 'For', SIGNER, mockSignTx);
    vi.runAllTimers();
    await votePromise;

    const proposalPromise = fetchProposals();
    vi.runAllTimers();
    const proposals = await proposalPromise;
    vi.useRealTimers();

    const proposal = proposals.find((p) => p.id === 3);
    expect(proposal?.userVote).toBe('For');
  });

  it('proposal without user vote has undefined userVote', async () => {
    vi.useFakeTimers();
    const proposalPromise = fetchProposals();
    vi.runAllTimers();
    const proposals = await proposalPromise;
    vi.useRealTimers();

    const proposal = proposals.find((p) => p.id === 2);
    expect(proposal?.userVote).toBeUndefined();
  });
});
