/**
 * Contract integration tests for governance functions (castVote, createProposal, etc.)
 * These operate as mocked Soroban calls until the governance contract is deployed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rpc, nativeToScVal } from '@stellar/stellar-sdk';

import {
  castVote,
  createProposal,
  fetchProposals,
  getProposals,
  fetchProposal,
  fetchProtocolParameters,
  getVotingPower,
  getUserVote,
  totalVotes,
  votePercent,
  quorumReached,
  timeRemaining,
  formatVotingPower,
  isValidStellarAddress,
  parameterLabel,
  parseProposalStatus,
  parseProposalFromNative,
  simulateProposalEffect,
  MOCK_PROPOSALS,
  type CreateProposalPayload,
} from '@/utils/governance';

const SIGNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const mockSignTx = vi.fn(async (_xdr: string) => 'signedXDR');

describe('governance – castVote', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a transaction hash string', async () => {
    vi.runAllTimersAsync();
    const hash = await castVote(1, 'For', SIGNER, mockSignTx);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it("records the user's vote choice", async () => {
    vi.runAllTimersAsync();
    await castVote(2, 'Against', SIGNER, mockSignTx);
    const recorded = getUserVote(2);
    expect(recorded).toBe('Against');
  });

  it('increments votesFor when voting For', async () => {
    const proposalId = 6;
    const before = MOCK_PROPOSALS.find((p) => p.id === proposalId)?.votesFor ?? 0;
    vi.runAllTimersAsync();
    await castVote(proposalId, 'For', SIGNER, mockSignTx);
    const after = MOCK_PROPOSALS.find((p) => p.id === proposalId)?.votesFor ?? 0;
    expect(after).toBeGreaterThan(before);
  });

  it('increments votesAgainst when voting Against', async () => {
    const proposalId = 1;
    const before = MOCK_PROPOSALS.find((p) => p.id === proposalId)?.votesAgainst ?? 0;
    vi.runAllTimersAsync();
    await castVote(proposalId, 'Against', SIGNER, mockSignTx);
    const after = MOCK_PROPOSALS.find((p) => p.id === proposalId)?.votesAgainst ?? 0;
    expect(after).toBeGreaterThan(before);
  });

  it('increments votesAbstain when voting Abstain', async () => {
    const proposalId = 2;
    const before = MOCK_PROPOSALS.find((p) => p.id === proposalId)?.votesAbstain ?? 0;
    vi.runAllTimersAsync();
    await castVote(proposalId, 'Abstain', SIGNER, mockSignTx);
    const after = MOCK_PROPOSALS.find((p) => p.id === proposalId)?.votesAbstain ?? 0;
    expect(after).toBeGreaterThan(before);
  });
});

describe('governance – fetchProposals & SDK boundary', () => {
  it('calls Soroban list_proposals and parses on-chain response correctly', async () => {
    const mockSimulate = vi
      .spyOn(rpc.Server.prototype, 'simulateTransaction')
      .mockResolvedValueOnce({
        error: undefined,
        transactionData: {} as any,
        minResourceFee: '100',
        events: [],
        result: {
          retval: nativeToScVal([
            {
              id: 10,
              title: 'On-Chain Governance Proposal',
              description: 'Proposal description from Soroban contract',
              type: { ParameterUpdate: [] },
              status: { Rejected: [] },
              proposer: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
              created_at: 1700000000,
              voting_starts_at: 1700000000,
              voting_ends_at: 1700864000,
              votes_for: 1000,
              votes_against: 2500,
              votes_abstain: 50,
              quorum_required: 500,
            },
          ]),
        },
      } as any);

    const proposals = await fetchProposals();

    expect(mockSimulate).toHaveBeenCalled();
    expect(proposals.length).toBe(1);
    expect(proposals[0].id).toBe(10);
    expect(proposals[0].title).toBe('On-Chain Governance Proposal');
    expect(proposals[0].status).toBe('Rejected');
    expect(proposals[0].type).toBe('ParameterUpdate');
    expect(proposals[0].votesFor).toBe(1000);
    expect(proposals[0].votesAgainst).toBe(2500);

    mockSimulate.mockRestore();
  });

  it('getProposals is an alias to fetchProposals', () => {
    expect(getProposals).toBe(fetchProposals);
  });

  it('returns an array of proposals on fallback', async () => {
    const mockSimulate = vi
      .spyOn(rpc.Server.prototype, 'simulateTransaction')
      .mockRejectedValueOnce(new Error('RPC Connection Error'));
    const proposals = await fetchProposals();
    expect(Array.isArray(proposals)).toBe(true);
    expect(proposals.length).toBeGreaterThan(0);
    mockSimulate.mockRestore();
  });

  it('each proposal has required fields', async () => {
    const mockSimulate = vi
      .spyOn(rpc.Server.prototype, 'simulateTransaction')
      .mockRejectedValueOnce(new Error('Simulate Error'));
    const proposals = await fetchProposals();
    for (const proposal of proposals) {
      expect(proposal).toHaveProperty('id');
      expect(proposal).toHaveProperty('title');
      expect(proposal).toHaveProperty('status');
      expect(proposal).toHaveProperty('votesFor');
      expect(proposal).toHaveProperty('votesAgainst');
    }
    mockSimulate.mockRestore();
  });
});

describe('governance – parseProposalStatus & contract parsers', () => {
  it('maps contract Rejected status correctly', () => {
    expect(parseProposalStatus({ Rejected: [] })).toBe('Rejected');
    expect(parseProposalStatus('Rejected')).toBe('Rejected');
  });

  it('maps other contract enum statuses correctly', () => {
    expect(parseProposalStatus({ Active: [] })).toBe('Active');
    expect(parseProposalStatus({ Passed: [] })).toBe('Passed');
    expect(parseProposalStatus({ Executed: [] })).toBe('Executed');
    expect(parseProposalStatus({ Vetoed: [] })).toBe('Vetoed');
    expect(parseProposalStatus('Active')).toBe('Active');
    expect(parseProposalStatus('Passed')).toBe('Passed');
  });

  it('falls back to Active for unknown status', () => {
    expect(parseProposalStatus('UnknownVal')).toBe('Active');
  });

  it('parseProposalFromNative parses native struct correctly', () => {
    const nativeStruct = {
      id: 42,
      title: 'Upgrade Protocol',
      description: 'Upgrade to v2',
      type: { ProtocolUpgrade: [] },
      status: { Rejected: [] },
      proposer: 'GPROPOSER',
      created_at: 100,
      voting_starts_at: 100,
      voting_ends_at: 200,
      votes_for: 300,
      votes_against: 150,
      votes_abstain: 20,
      quorum_required: 100,
    };
    const parsed = parseProposalFromNative(nativeStruct);
    expect(parsed.id).toBe(42);
    expect(parsed.title).toBe('Upgrade Protocol');
    expect(parsed.type).toBe('ProtocolUpgrade');
    expect(parsed.status).toBe('Rejected');
    expect(parsed.proposer).toBe('GPROPOSER');
  });
});

describe('governance – fetchProposal', () => {
  it('returns a specific proposal by ID', async () => {
    vi.useFakeTimers();
    const p = fetchProposal(1);
    vi.runAllTimers();
    const proposal = await p;
    vi.useRealTimers();
    expect(proposal).not.toBeNull();
    expect(proposal?.id).toBe(1);
  });

  it('returns null for non-existent proposal ID', async () => {
    vi.useFakeTimers();
    const p = fetchProposal(9999);
    vi.runAllTimers();
    const proposal = await p;
    vi.useRealTimers();
    expect(proposal).toBeNull();
  });
});

describe('governance – createProposal', () => {
  it('creates a FeeRate proposal and returns txHash + proposalId', async () => {
    vi.useFakeTimers();
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Reduce fee to 0.2%',
      description: 'Lower protocol fees for better LP returns',
      newValueBps: 20,
    };

    const promise = createProposal(payload, SIGNER, mockSignTx);
    vi.runAllTimers();
    const result = await promise;
    vi.useRealTimers();

    expect(typeof result.txHash).toBe('string');
    expect(typeof result.proposalId).toBe('number');
    expect(result.proposalId).toBeGreaterThan(0);
  });

  it('creates an AddToken proposal with parameterChanges', async () => {
    vi.useFakeTimers();
    const payload: CreateProposalPayload = {
      formType: 'AddToken',
      title: 'Add wBTC',
      description: 'Add wrapped Bitcoin as accepted token',
      tokenAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      tokenName: 'Wrapped Bitcoin',
    };

    const promise = createProposal(payload, SIGNER, mockSignTx);
    vi.runAllTimers();
    const result = await promise;
    vi.useRealTimers();

    expect(result.proposalId).toBeGreaterThan(0);
    const created = MOCK_PROPOSALS.find((p) => p.id === result.proposalId);
    expect(created?.parameterChanges).toBeDefined();
  });
});

describe('governance – vote helper functions', () => {
  const proposal = MOCK_PROPOSALS[0];

  it('totalVotes sums all vote types correctly', () => {
    const total = totalVotes(proposal);
    expect(total).toBe(proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain);
  });

  it('votePercent returns 0 for zero total', () => {
    expect(votePercent(0, 0)).toBe(0);
  });

  it('votePercent calculates percentage with one decimal', () => {
    expect(votePercent(1, 3)).toBeCloseTo(33.3, 1);
  });

  it('quorumReached returns true when votes meet threshold', () => {
    const mockProposal = {
      ...proposal,
      votesFor: 200_000,
      votesAgainst: 0,
      votesAbstain: 0,
      quorumRequired: 100_000,
    };
    expect(quorumReached(mockProposal)).toBe(true);
  });

  it('quorumReached returns false below threshold', () => {
    const mockProposal = {
      ...proposal,
      votesFor: 10_000,
      votesAgainst: 5_000,
      votesAbstain: 1_000,
      quorumRequired: 100_000,
    };
    expect(quorumReached(mockProposal)).toBe(false);
  });

  it('timeRemaining returns empty string for non-active proposals', () => {
    const passed = MOCK_PROPOSALS.find((p) => p.status === 'Passed') ?? {
      ...proposal,
      status: 'Passed' as const,
    };
    expect(timeRemaining(passed)).toBe('');
  });

  it('formatVotingPower formats millions correctly', () => {
    expect(formatVotingPower(1_500_000)).toContain('M ILN');
  });

  it('formatVotingPower formats thousands correctly', () => {
    expect(formatVotingPower(2_500)).toContain('K ILN');
  });

  it('formatVotingPower formats small amounts', () => {
    expect(formatVotingPower(500)).toBe('500 ILN');
  });
});

describe('governance – address validation', () => {
  it('accepts valid Stellar G-addresses', () => {
    expect(isValidStellarAddress(SIGNER)).toBe(true);
    expect(isValidStellarAddress('GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBVN')).toBe(
      true
    );
  });

  it('rejects invalid addresses', () => {
    expect(isValidStellarAddress('not-an-address')).toBe(false);
    expect(isValidStellarAddress('')).toBe(false);
    expect(isValidStellarAddress('GABC123')).toBe(false);
    expect(isValidStellarAddress('X' + 'A'.repeat(55))).toBe(false);
  });
});

describe('governance – parameterLabel', () => {
  it('returns human-readable label for known parameters', () => {
    expect(parameterLabel('fee_rate_bps')).toBe('Protocol fee rate');
    expect(parameterLabel('quorum_threshold_bps')).toBe('Quorum threshold');
    expect(parameterLabel('accepted_tokens')).toBe('Accepted tokens');
  });

  it('prettifies unknown parameters by replacing underscores', () => {
    expect(parameterLabel('some_custom_param')).toBe('some custom param');
  });
});

describe('governance – getVotingPower', () => {
  it('returns a positive number', async () => {
    vi.useFakeTimers();
    const p = getVotingPower(SIGNER);
    vi.runAllTimers();
    const power = await p;
    vi.useRealTimers();
    expect(typeof power).toBe('number');
    expect(power).toBeGreaterThan(0);
  });
});

describe('governance – fetchProtocolParameters', () => {
  it('returns protocol parameters with expected shape', async () => {
    vi.useFakeTimers();
    const p = fetchProtocolParameters();
    vi.runAllTimers();
    const params = await p;
    vi.useRealTimers();
    expect(params).toHaveProperty('feeRateBps');
    expect(params).toHaveProperty('maxDiscountRateBps');
    expect(params).toHaveProperty('acceptedTokens');
    expect(Array.isArray(params.acceptedTokens)).toBe(true);
  });
});

describe('governance – simulateProposalEffect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a result with isContractVerified and estimatedEffect fields', async () => {
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Update Fee Rate',
      description: 'Proposal to update fee rate',
      newValueBps: 300,
    };
    vi.runAllTimersAsync();
    const result = await simulateProposalEffect(payload);
    vi.useRealTimers();
    expect(result).toHaveProperty('isContractVerified');
    expect(result).toHaveProperty('estimatedEffect');
    expect(typeof result.isContractVerified).toBe('boolean');
    expect(typeof result.estimatedEffect).toBe('string');
  });

  it('generates estimate for FeeRate proposals', async () => {
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Update Fee Rate',
      description: 'Test proposal',
      newValueBps: 400,
    };
    vi.runAllTimersAsync();
    const result = await simulateProposalEffect(payload);
    vi.useRealTimers();
    expect(result.estimatedEffect).toContain('fee rate');
    expect(result.estimatedEffect).toContain('4');
  });

  it('generates estimate for MaxDiscountRate proposals', async () => {
    const payload: CreateProposalPayload = {
      formType: 'MaxDiscountRate',
      title: 'Update Discount Rate',
      description: 'Test proposal',
      newValueBps: 600,
    };
    vi.runAllTimersAsync();
    const result = await simulateProposalEffect(payload);
    vi.useRealTimers();
    expect(result.estimatedEffect).toContain('discount rate');
    expect(result.estimatedEffect).toContain('6');
  });

  it('generates estimate for AddToken proposals', async () => {
    const payload: CreateProposalPayload = {
      formType: 'AddToken',
      title: 'Add Token',
      description: 'Test proposal',
      tokenAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      tokenName: 'Wrapped Bitcoin',
    };
    vi.runAllTimersAsync();
    const result = await simulateProposalEffect(payload);
    vi.useRealTimers();
    expect(result.estimatedEffect).toContain('Add');
    expect(result.estimatedEffect).toContain('Wrapped Bitcoin');
  });

  it('generates estimate for RemoveToken proposals', async () => {
    const payload: CreateProposalPayload = {
      formType: 'RemoveToken',
      title: 'Remove Token',
      description: 'Test proposal',
      removeTokenAddress: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    };
    vi.runAllTimersAsync();
    const result = await simulateProposalEffect(payload);
    vi.useRealTimers();
    expect(result.estimatedEffect).toContain('Remove');
  });

  it('includes disclaimer for client-side estimates', async () => {
    const payload: CreateProposalPayload = {
      formType: 'FeeRate',
      title: 'Update Fee Rate',
      description: 'Test proposal',
      newValueBps: 250,
    };
    vi.runAllTimersAsync();
    const result = await simulateProposalEffect(payload);
    vi.useRealTimers();
    if (!result.isContractVerified) {
      expect(result.warnings).toBeDefined();
      if (result.warnings) {
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    }
  });
});
