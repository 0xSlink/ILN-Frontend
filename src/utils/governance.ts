import {
  rpc,
  xdr,
  scValToNative,
  TransactionBuilder,
  Account,
  BASE_FEE,
  Operation,
} from '@stellar/stellar-sdk';
import { GOVERNANCE_CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '@/constants';

// ─── RPC & Contract helpers ───────────────────────────────────────────────────

const server = new rpc.Server(RPC_URL);
const READ_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function buildGovernanceReadTransaction(method: string, params: xdr.ScVal[] = []) {
  return new TransactionBuilder(new Account(READ_ACCOUNT, '0'), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: GOVERNANCE_CONTRACT_ID,
        function: method,
        args: params,
      })
    )
    .setTimeout(30)
    .build();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProposalType = 'ParameterUpdate' | 'ProtocolUpgrade' | 'TextProposal';
export type ProposalStatus =
  | 'Active'
  | 'Passed'
  | 'Rejected'
  | 'Executed'
  | 'Pending'
  | 'Vetoed'
  | 'Failed';
export type VoteChoice = 'For' | 'Against' | 'Abstain';

export interface VetoRecord {
  proposalId: number;
  admin: string;
  reasonHash: string;
  createdAt: number;
}

export interface ParameterChange {
  parameter: string;
  currentValue: string;
  newValue: string;
}

export interface VoteCastEvent {
  proposalId: number;
  proposalTitle: string;
  voter: string;
  vote: VoteChoice;
  weight: number;
  timestamp: number;
}

export interface Proposal {
  id: number;
  title: string;
  description: string;
  type: ProposalType;
  status: ProposalStatus;
  proposer: string;
  createdAt: number;
  votingStartsAt: number;
  votingEndsAt: number;
  executableAfter?: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  quorumRequired: number;
  parameterChanges?: ParameterChange[];
  userVote?: VoteChoice;
  vetoHistory?: VetoRecord[];
}

// Keep this aligned with docs/contract-integration-status.md so the UI
// automatically reflects the current live vs mock-backed governance status.
type GovernanceActionName =
  | 'castVote'
  | 'delegateVotingPower'
  | 'createProposal'
  | 'executeProposal'
  | 'vetoProposal'
  | 'getVotingPower'
  | 'getGovTokenBalance'
  | 'getQuorumThreshold'
  | 'getProposalHistory';

export const GOVERNANCE_INTEGRATION_STATUS: Record<
  GovernanceActionName,
  { status: 'Real' | 'Stubbed'; label: string }
> = {
  castVote: {
    status: 'Stubbed',
    label: 'Vote casting',
  },
  delegateVotingPower: {
    status: 'Stubbed',
    label: 'Vote delegation',
  },
  createProposal: {
    status: 'Stubbed',
    label: 'Proposal creation',
  },
  executeProposal: {
    status: 'Stubbed',
    label: 'Proposal execution',
  },
  vetoProposal: {
    status: 'Stubbed',
    label: 'Proposal veto',
  },
  getVotingPower: {
    status: 'Stubbed',
    label: 'Voting power lookup',
  },
  getGovTokenBalance: {
    status: 'Stubbed',
    label: 'Token balance lookup',
  },
  getQuorumThreshold: {
    status: 'Stubbed',
    label: 'Quorum threshold lookup',
  },
  getProposalHistory: {
    status: 'Stubbed',
    label: 'Proposal history lookup',
  },
};

export type GovernanceAction = keyof typeof GOVERNANCE_INTEGRATION_STATUS;

// ─── Mock data ────────────────────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

export const MOCK_PROPOSALS: Proposal[] = [
  {
    id: 1,
    title: 'Reduce Base Discount Rate to 3.5%',
    description:
      "This proposal reduces the protocol's base discount rate from 5% to 3.5% to improve competitiveness with traditional invoice factoring services and attract higher invoice volume from freelancers.",
    type: 'ParameterUpdate',
    status: 'Active',
    proposer: 'GDXYZ...A3KP',
    createdAt: NOW - 2 * DAY,
    votingStartsAt: NOW - 2 * DAY,
    votingEndsAt: NOW + 5 * DAY,
    votesFor: 142_500,
    votesAgainst: 38_200,
    votesAbstain: 9_100,
    quorumRequired: 100_000,
    parameterChanges: [
      { parameter: 'base_discount_rate', currentValue: '500 (5%)', newValue: '350 (3.5%)' },
    ],
  },
  {
    id: 2,
    title: 'Increase Quorum Threshold to 15%',
    description:
      'To ensure governance decisions represent a meaningful fraction of the token supply, this proposal raises the minimum quorum from 10% to 15% of circulating ILN tokens.',
    type: 'ParameterUpdate',
    status: 'Active',
    proposer: 'GBCDE...F7QR',
    createdAt: NOW - 1 * DAY,
    votingStartsAt: NOW - 1 * DAY,
    votingEndsAt: NOW + 6 * DAY,
    votesFor: 56_000,
    votesAgainst: 71_300,
    votesAbstain: 4_200,
    quorumRequired: 100_000,
    parameterChanges: [
      { parameter: 'quorum_threshold_bps', currentValue: '1000 (10%)', newValue: '1500 (15%)' },
    ],
  },
  {
    id: 3,
    title: 'Add EURC as Accepted Invoice Currency',
    description:
      "Expand the protocol's multi-token support by adding EURC (Euro Coin) as a valid invoice denomination alongside USDC. This targets European freelancers and eliminates FX conversion costs.",
    type: 'ProtocolUpgrade',
    status: 'Passed',
    proposer: 'GCFGH...B2MN',
    createdAt: NOW - 14 * DAY,
    votingStartsAt: NOW - 14 * DAY,
    votingEndsAt: NOW - 7 * DAY,
    executableAfter: NOW - 4 * DAY,
    votesFor: 215_800,
    votesAgainst: 44_100,
    votesAbstain: 12_400,
    quorumRequired: 100_000,
    parameterChanges: [
      {
        parameter: 'accepted_tokens',
        currentValue: '[USDC]',
        newValue: '[USDC, EURC]',
      },
    ],
  },
  {
    id: 4,
    title: 'Extend Voting Period to 10 Days',
    description:
      'Increase the governance voting window from 7 days to 10 days to give token holders across all time zones and schedules adequate opportunity to participate.',
    type: 'ParameterUpdate',
    status: 'Executed',
    proposer: 'GHIJK...L9PQ',
    createdAt: NOW - 30 * DAY,
    votingStartsAt: NOW - 30 * DAY,
    votingEndsAt: NOW - 23 * DAY,
    executableAfter: NOW - 20 * DAY,
    votesFor: 189_600,
    votesAgainst: 22_300,
    votesAbstain: 6_100,
    quorumRequired: 100_000,
    parameterChanges: [
      {
        parameter: 'voting_period_seconds',
        currentValue: '604800 (7 days)',
        newValue: '864000 (10 days)',
      },
    ],
  },
  {
    id: 5,
    title: 'Signal: Explore On-Chain Credit Scoring Integration',
    description:
      'A text proposal to gauge community sentiment on integrating a decentralised on-chain credit scoring module that could lower discount rates for freelancers with proven track records.',
    type: 'TextProposal',
    status: 'Failed',
    proposer: 'GLMNO...P4RS',
    createdAt: NOW - 20 * DAY,
    votingStartsAt: NOW - 20 * DAY,
    votingEndsAt: NOW - 13 * DAY,
    votesFor: 44_200,
    votesAgainst: 88_700,
    votesAbstain: 11_500,
    quorumRequired: 100_000,
  },
  {
    id: 6,
    title: 'Deploy LP Yield Optimiser Contract',
    description:
      'Deploy a new ancillary contract that auto-compounds LP yield by re-deploying earned USDC into the highest-APY invoice pool at the end of each epoch.',
    type: 'ProtocolUpgrade',
    status: 'Active',
    proposer: 'GTUV...W5XY',
    createdAt: NOW - 3 * DAY,
    votingStartsAt: NOW - 3 * DAY,
    votingEndsAt: NOW + 4 * DAY,
    votesFor: 87_400,
    votesAgainst: 19_800,
    votesAbstain: 3_600,
    quorumRequired: 100_000,
  },
  {
    id: 7,
    title: 'Lower Protocol Fee Rate to 0.3%',
    description:
      "Reduce the protocol fee from 0.5% to 0.3% to pass more value back to liquidity providers and improve the protocol's competitiveness ahead of mainnet.",
    type: 'ParameterUpdate',
    status: 'Executed',
    proposer: 'GQRST...U8VW',
    createdAt: NOW - 9 * DAY,
    votingStartsAt: NOW - 9 * DAY,
    votingEndsAt: NOW - 2 * DAY,
    // Executed roughly 8 hours ago — recent enough to surface in the
    // homepage / marketplace announcement banner (48h window).
    executableAfter: NOW - Math.floor(DAY / 3),
    votesFor: 173_200,
    votesAgainst: 18_900,
    votesAbstain: 4_700,
    quorumRequired: 100_000,
    parameterChanges: [
      { parameter: 'fee_rate_bps', currentValue: '50 (0.5%)', newValue: '30 (0.3%)' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function totalVotes(proposal: Proposal): number {
  return proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
}

export function votePercent(votes: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((votes / total) * 1000) / 10; // one decimal place
}

export function quorumReached(proposal: Proposal): boolean {
  return totalVotes(proposal) >= proposal.quorumRequired;
}

export function timeRemaining(proposal: Proposal): string {
  const now = Math.floor(Date.now() / 1000);
  if (proposal.status !== 'Active') return '';
  const diff = proposal.votingEndsAt - now;
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / 3600);
  if (days > 0) return `${days}d ${hours}h remaining`;
  const mins = Math.floor((diff % 3600) / 60);
  return `${hours}h ${mins}m remaining`;
}

export function formatVotingPower(power: number): string {
  if (power >= 1_000_000) return (power / 1_000_000).toFixed(2) + 'M ILN';
  if (power >= 1_000) return (power / 1_000).toFixed(1) + 'K ILN';
  return power.toFixed(0) + ' ILN';
}

// ─── Mock voting state (per-session in-memory store) ──────────────────────────

const userVotes: Map<number, VoteChoice> = new Map();
const vetoHistory: VetoRecord[] = [];

export function getUserVote(proposalId: number): VoteChoice | undefined {
  return userVotes.get(proposalId);
}

// ─── Contract Parsers ─────────────────────────────────────────────────────────

export function parseProposalStatus(status: unknown): ProposalStatus {
  if (status && typeof status === 'object') {
    const key = Object.keys(status as object)[0];
    if (key === 'Rejected') return 'Rejected';
    if (
      key === 'Active' ||
      key === 'Passed' ||
      key === 'Executed' ||
      key === 'Vetoed' ||
      key === 'Pending' ||
      key === 'Failed'
    ) {
      return key as ProposalStatus;
    }
  }
  const str = String(status);
  if (str === 'Rejected') return 'Rejected';
  if (
    str === 'Active' ||
    str === 'Passed' ||
    str === 'Executed' ||
    str === 'Vetoed' ||
    str === 'Pending' ||
    str === 'Failed'
  ) {
    return str as ProposalStatus;
  }
  return 'Active';
}

export function parseProposalType(action: unknown): ProposalType {
  if (action && typeof action === 'object') {
    const key = Object.keys(action as object)[0];
    if (key === 'ParameterUpdate' || key === 'ProtocolUpgrade' || key === 'TextProposal') {
      return key as ProposalType;
    }
  }
  const str = String(action);
  if (str === 'ParameterUpdate' || str === 'ProtocolUpgrade' || str === 'TextProposal') {
    return str as ProposalType;
  }
  return 'ParameterUpdate';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseProposalFromNative(native: any): Proposal {
  return {
    id: Number(native.id ?? 0),
    title:
      typeof native.title === 'string' ? native.title : native.title ? String(native.title) : '',
    description:
      typeof native.description === 'string'
        ? native.description
        : native.description
          ? String(native.description)
          : '',
    type: parseProposalType(native.type ?? native.action),
    status: parseProposalStatus(native.status),
    proposer: String(native.proposer ?? ''),
    createdAt: Number(native.created_at ?? native.createdAt ?? 0),
    votingStartsAt: Number(native.voting_starts_at ?? native.votingStartsAt ?? 0),
    votingEndsAt: Number(native.voting_ends_at ?? native.votingEndsAt ?? 0),
    executableAfter: native.executable_after
      ? Number(native.executable_after)
      : native.executableAfter
        ? Number(native.executableAfter)
        : undefined,
    votesFor: Number(native.votes_for ?? native.votesFor ?? 0),
    votesAgainst: Number(native.votes_against ?? native.votesAgainst ?? 0),
    votesAbstain: Number(native.votes_abstain ?? native.votesAbstain ?? 0),
    quorumRequired: Number(native.quorum_required ?? native.quorumRequired ?? 0),
    parameterChanges: Array.isArray(native.parameter_changes ?? native.parameterChanges)
      ? (native.parameter_changes ?? native.parameterChanges).map((pc: any) => ({
          parameter: String(pc.parameter ?? ''),
          currentValue: String(pc.current_value ?? pc.currentValue ?? ''),
          newValue: String(pc.new_value ?? pc.newValue ?? ''),
        }))
      : undefined,
  };
}

// ─── Contract Integration Calls ────────────────────────────────────────────────

export async function fetchProposals(): Promise<Proposal[]> {
  try {
    const tx = buildGovernanceReadTransaction('list_proposals');
    const callResult = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(callResult) && callResult.result?.retval) {
      const native = scValToNative(callResult.result.retval);
      if (Array.isArray(native)) {
        return native.map((p) => ({
          ...parseProposalFromNative(p),
          userVote: userVotes.get(Number(p.id)),
          vetoHistory: getVetoHistory(Number(p.id)),
        }));
      }
    }
  } catch (err) {
    console.warn(
      'iln_governance list_proposals contract call failed, falling back to mock data:',
      err
    );
  }

  return MOCK_PROPOSALS.map((p) => ({
    ...p,
    userVote: userVotes.get(p.id),
    vetoHistory: getVetoHistory(p.id),
  }));
}

export const getProposals = fetchProposals;

export async function fetchProposal(id: number): Promise<Proposal | null> {
  const proposals = await fetchProposals();
  const proposal = proposals.find((p) => p.id === id);
  if (!proposal) return null;
  return { ...proposal, userVote: userVotes.get(id), vetoHistory: getVetoHistory(id) };
}

export async function castVote(
  proposalId: number,
  choice: VoteChoice,
  signerAddress: string,
  _signTx: (xdr: string) => Promise<string>
): Promise<string> {
  // TODO: Replace with actual Soroban transaction once governance contract is deployed
  // Ref: #111
  await new Promise((r) => setTimeout(r, 2000));

  const proposal = MOCK_PROPOSALS.find((p) => p.id === proposalId);
  userVotes.set(proposalId, choice);

  if (proposal) {
    const power = 1250;
    if (choice === 'For') proposal.votesFor += power;
    else if (choice === 'Against') proposal.votesAgainst += power;
    else proposal.votesAbstain += power;
  }

  // Attempt real contract interaction if signTx is available
  if (signerAddress) {
    try {
      // Execute vote recording operation
      const mockTxHash = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      return mockTxHash;
    } catch (err) {
      console.warn('On-chain vote recording fallback:', err);
    }
  }

  return Math.random().toString(16).substring(2, 18);
}

export async function executeProposal(
  proposalId: number,
  signerAddress: string,
  _signTx: (xdr: string) => Promise<string>
): Promise<string> {
  // TODO: Replace with actual Soroban transaction once governance contract is deployed
  // Ref: #111
  await new Promise((r) => setTimeout(r, 2000));

  const proposal = MOCK_PROPOSALS.find((p) => p.id === proposalId);
  if (proposal) {
    proposal.status = 'Executed';
  }

  if (signerAddress) {
    try {
      const mockTxHash = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      return mockTxHash;
    } catch (err) {
      console.warn('On-chain proposal execution fallback:', err);
    }
  }

  return Math.random().toString(16).substring(2, 18);
}

export async function vetoProposal(
  proposalId: number,
  reasonHash: string,
  adminAddress: string,
  _signTx: (xdr: string) => Promise<string>
): Promise<string> {
  await new Promise((r) => setTimeout(r, 1200));

  const proposal = MOCK_PROPOSALS.find((p) => p.id === proposalId);
  if (!proposal) throw new Error('Proposal not found');

  proposal.status = 'Vetoed';
  const record: VetoRecord = {
    proposalId,
    admin: adminAddress,
    reasonHash,
    createdAt: Math.floor(Date.now() / 1000),
  };
  vetoHistory.unshift(record);
  proposal.vetoHistory = [record, ...(proposal.vetoHistory ?? [])];

  return Math.random().toString(16).substring(2, 18);
}

export function getVetoHistory(proposalId: number): VetoRecord[] {
  return vetoHistory.filter((record) => record.proposalId === proposalId);
}

export async function getVotingPower(_address: string): Promise<number> {
  // TODO: Fetch from ILN token contract once deployed
  // Ref: #111
  await new Promise((r) => setTimeout(r, 200));
  return 1250; // mock: 1,250 ILN tokens
}

export async function getDelegationInfo(address: string): Promise<{
  delegatedTo: string | null;
  delegatedAmount: number;
  incomingDelegations: number;
}> {
  // Mock implementation - replace with actual Soroban calls
  // In a real implementation, this would query the governance contract
  await new Promise((r) => setTimeout(r, 150));

  // Simulate some users having delegations
  const mockDelegations = {
    GABC123: {
      delegatedTo: 'GDEF456EXAMPLE789ABC012GHI345JKL678MNO901PQR234STU567VWX890YZ',
      delegatedAmount: 500,
      incomingDelegations: 0,
    },
    GDEF456: {
      delegatedTo: null,
      delegatedAmount: 0,
      incomingDelegations: 1200,
    },
  };

  const shortAddress = address.slice(0, 7);
  const mockData = mockDelegations[shortAddress as keyof typeof mockDelegations];

  if (mockData) {
    return mockData;
  }

  // Default: no delegation
  return {
    delegatedTo: null,
    delegatedAmount: 0,
    incomingDelegations: Math.floor(Math.random() * 500), // Random incoming delegations for demo
  };
}

// ─── Proposal creation ────────────────────────────────────────────────────────

/** The four form-level proposal types exposed in the creation UI */
export type CreateProposalFormType = 'FeeRate' | 'AddToken' | 'RemoveToken' | 'MaxDiscountRate';

export interface AcceptedToken {
  address: string;
  name: string;
  symbol: string;
}

export interface ProtocolParameters {
  /** Current protocol fee rate in basis points (e.g. 50 = 0.5%) */
  feeRateBps: number;
  /** Current maximum discount rate in basis points (e.g. 500 = 5%) */
  maxDiscountRateBps: number;
  /** Tokens currently accepted by the protocol */
  acceptedTokens: AcceptedToken[];
  /** Minimum ILN balance required to submit a proposal */
  minProposalILN: number;
}

export interface CreateProposalPayload {
  formType: CreateProposalFormType;
  title: string;
  description: string;
  /** New basis-point value for FeeRate / MaxDiscountRate proposals */
  newValueBps?: number;
  /** Token address for AddToken proposals */
  tokenAddress?: string;
  /** Resolved token name (AddToken) */
  tokenName?: string;
  /** Token address to remove (RemoveToken) */
  removeTokenAddress?: string;
}

// ─── Mock protocol parameter state ───────────────────────────────────────────

const MOCK_PROTOCOL_PARAMS: ProtocolParameters = {
  feeRateBps: 50, // 0.5%
  maxDiscountRateBps: 500, // 5%
  acceptedTokens: [
    {
      address: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
      name: 'USD Coin',
      symbol: 'USDC',
    },
    {
      address: 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV',
      name: 'Euro Coin',
      symbol: 'EURC',
    },
  ],
  minProposalILN: 500,
};

/**
 * Fetch current on-chain protocol parameters.
 * TODO: Replace with actual Soroban read-only calls once governance contract is deployed.
 * Ref: #111
 */
export async function fetchProtocolParameters(): Promise<ProtocolParameters> {
  await new Promise((r) => setTimeout(r, 400));
  return { ...MOCK_PROTOCOL_PARAMS };
}

/** Stellar address basic format check: starts with G, 56 chars, valid base-32 charset */
const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_RE.test(address.trim());
}

/**
 * Validate and look up a token name from a Stellar asset address.
 * Returns the resolved AcceptedToken or throws a descriptive error.
 * TODO: Replace with real Stellar SDK / Horizon lookup once deployed.
 * Ref: #111
 */
export async function lookupToken(address: string): Promise<AcceptedToken> {
  if (!isValidStellarAddress(address)) {
    throw new Error('Invalid Stellar address. Must start with G and be 56 characters.');
  }

  await new Promise((r) => setTimeout(r, 800));

  // Check if it's already an accepted token
  const existing = MOCK_PROTOCOL_PARAMS.acceptedTokens.find((t) => t.address === address.trim());
  if (existing) {
    throw new Error(`${existing.symbol} is already an accepted token.`);
  }

  // Simulate a small set of "known" testnet tokens
  const KNOWN_TOKENS: Record<string, AcceptedToken> = {
    CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC: {
      address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      name: 'Wrapped Bitcoin',
      symbol: 'wBTC',
    },
    CAZF3TRE3TFUMYQ7GDBP2HMRH4CW4GI7XPQFVFYXFBXNJLKH2BLNSJP: {
      address: 'CAZF3TRE3TFUMYQ7GDBP2HMRH4CW4GI7XPQFVFYXFBXNJLKH2BLNSJP',
      name: 'Wrapped Ether',
      symbol: 'wETH',
    },
    CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA: {
      address: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
      name: 'Stellar AQUA',
      symbol: 'AQUA',
    },
  };

  const known = KNOWN_TOKENS[address.trim()];
  if (known) return known;

  // For unknown addresses, return a generic placeholder (real impl would query Horizon)
  return {
    address: address.trim(),
    name: 'Unknown Token',
    symbol: address.slice(0, 4).toUpperCase(),
  };
}

/**
 * Submit a new governance proposal to the contract.
 * TODO: Replace with actual Soroban transaction once governance contract is deployed.
 * Ref: #111
 */
export async function createProposal(
  payload: CreateProposalPayload,
  _signerAddress: string,
  _signTx: (xdr: string) => Promise<string>
): Promise<{ txHash: string; proposalId: number }> {
  await new Promise((r) => setTimeout(r, 2500));

  const newId = MOCK_PROPOSALS.length + 1;
  const NOW_SEC = Math.floor(Date.now() / 1000);
  const DAY_SEC = 86400;

  // Map form type → internal ProposalType
  const typeMap: Record<CreateProposalFormType, ProposalType> = {
    FeeRate: 'ParameterUpdate',
    MaxDiscountRate: 'ParameterUpdate',
    AddToken: 'ProtocolUpgrade',
    RemoveToken: 'ProtocolUpgrade',
  };

  // Map form type → parameter change
  let parameterChanges: ParameterChange[] | undefined;
  if (payload.formType === 'FeeRate' && payload.newValueBps !== undefined) {
    parameterChanges = [
      {
        parameter: 'fee_rate_bps',
        currentValue: `${MOCK_PROTOCOL_PARAMS.feeRateBps} (${MOCK_PROTOCOL_PARAMS.feeRateBps / 100}%)`,
        newValue: `${payload.newValueBps} (${payload.newValueBps / 100}%)`,
      },
    ];
  } else if (payload.formType === 'MaxDiscountRate' && payload.newValueBps !== undefined) {
    parameterChanges = [
      {
        parameter: 'max_discount_rate_bps',
        currentValue: `${MOCK_PROTOCOL_PARAMS.maxDiscountRateBps} (${MOCK_PROTOCOL_PARAMS.maxDiscountRateBps / 100}%)`,
        newValue: `${payload.newValueBps} (${payload.newValueBps / 100}%)`,
      },
    ];
  } else if (payload.formType === 'AddToken' && payload.tokenAddress) {
    const existing = MOCK_PROTOCOL_PARAMS.acceptedTokens.map((t) => t.symbol);
    parameterChanges = [
      {
        parameter: 'accepted_tokens',
        currentValue: `[${existing.join(', ')}]`,
        newValue: `[${existing.join(', ')}, ${payload.tokenName ?? payload.tokenAddress.slice(0, 6)}]`,
      },
    ];
  } else if (payload.formType === 'RemoveToken' && payload.removeTokenAddress) {
    const token = MOCK_PROTOCOL_PARAMS.acceptedTokens.find(
      (t) => t.address === payload.removeTokenAddress
    );
    const remaining = MOCK_PROTOCOL_PARAMS.acceptedTokens
      .filter((t) => t.address !== payload.removeTokenAddress)
      .map((t) => t.symbol);
    parameterChanges = [
      {
        parameter: 'accepted_tokens',
        currentValue: `[${MOCK_PROTOCOL_PARAMS.acceptedTokens.map((t) => t.symbol).join(', ')}]`,
        newValue: `[${remaining.join(', ')}]${token ? ` (removes ${token.symbol})` : ''}`,
      },
    ];
  }

  const newProposal: Proposal = {
    id: newId,
    title: payload.title,
    description: payload.description,
    type: typeMap[payload.formType],
    status: 'Active',
    proposer: _signerAddress,
    createdAt: NOW_SEC,
    votingStartsAt: NOW_SEC,
    votingEndsAt: NOW_SEC + 7 * DAY_SEC,
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    quorumRequired: 100_000,
    parameterChanges,
  };

  MOCK_PROPOSALS.push(newProposal);

  return {
    txHash: Math.random().toString(16).substring(2, 18),
    proposalId: newId,
  };
}

// ─── Parameter change announcements (#153) ────────────────────────────────────

/**
 * A single applied protocol-parameter change, suitable for surfacing in an
 * announcement banner. Mirrors the data a `ParameterUpdated` contract event
 * would carry.
 */
export interface ParameterUpdateEvent {
  /** Stable id used for per-event dismissal (`{proposalId}:{parameter}`). */
  id: string;
  /** The governance proposal that enacted this change (for deep-linking). */
  proposalId: number;
  /** Raw on-chain parameter key, e.g. `fee_rate_bps`. */
  parameter: string;
  /** Human-readable parameter name, e.g. "Protocol fee rate". */
  label: string;
  /** Formatted new value as shown on the proposal, e.g. "30 (0.3%)". */
  newValue: string;
  /** Unix seconds when the change took effect (proposal execution time). */
  updatedAt: number;
}

/** Human-readable labels for known protocol parameters. */
const PARAMETER_LABELS: Record<string, string> = {
  fee_rate_bps: 'Protocol fee rate',
  base_discount_rate: 'Base discount rate',
  max_discount_rate_bps: 'Maximum discount rate',
  quorum_threshold_bps: 'Quorum threshold',
  voting_period_seconds: 'Voting period',
  accepted_tokens: 'Accepted tokens',
  min_invoice_amount: 'Minimum invoice amount',
  reputation_threshold: 'Reputation threshold',
};

/** Map a raw parameter key to a friendly label, falling back to a prettified key. */
export function parameterLabel(parameter: string): string {
  return PARAMETER_LABELS[parameter] ?? parameter.replace(/_/g, ' ');
}

/**
 * Fetch the protocol parameter changes that have been enacted, newest first.
 *
 * Derived from executed `ParameterUpdate` proposals. Consumers (e.g. the
 * {@link ParameterUpdateBanner}) decide how recent a change must be to surface.
 *
 * TODO: Replace with a Soroban `getEvents` subscription for `ParameterUpdated`
 * contract events once the governance contract is deployed.
 * Ref: #111
 */
export async function fetchParameterUpdates(): Promise<ParameterUpdateEvent[]> {
  const proposals = await fetchProposals();

  return proposals
    .filter((p) => p.status === 'Executed' && p.parameterChanges?.length)
    .flatMap((p) => {
      // Execution time: when the proposal became executable, else when voting ended.
      const updatedAt = p.executableAfter ?? p.votingEndsAt;
      return (p.parameterChanges ?? []).map((change) => ({
        id: `${p.id}:${change.parameter}`,
        proposalId: p.id,
        parameter: change.parameter,
        label: parameterLabel(change.parameter),
        newValue: change.newValue,
        updatedAt,
      }));
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// ─── Governance Activity ──────────────────────────────────────────────────────

export const MOCK_VOTES: VoteCastEvent[] = [
  {
    proposalId: 1,
    proposalTitle: 'Reduce Base Discount Rate to 3.5%',
    voter: 'GABC123EXAMPLE456789ABC012GHI345JKL678MNO901PQR234STU567VWX890YZ',
    vote: 'For',
    weight: 1250,
    timestamp: NOW - 1.5 * DAY,
  },
  {
    proposalId: 3,
    proposalTitle: 'Add EURC as Accepted Invoice Currency',
    voter: 'GABC123EXAMPLE456789ABC012GHI345JKL678MNO901PQR234STU567VWX890YZ',
    vote: 'For',
    weight: 1250,
    timestamp: NOW - 10 * DAY,
  },
  {
    proposalId: 4,
    proposalTitle: 'Extend Voting Period to 10 Days',
    voter: 'GABC123EXAMPLE456789ABC012GHI345JKL678MNO901PQR234STU567VWX890YZ',
    vote: 'Against',
    weight: 1250,
    timestamp: NOW - 25 * DAY,
  },
  {
    proposalId: 7,
    proposalTitle: 'Lower Protocol Fee Rate to 0.3%',
    voter: 'GABC123EXAMPLE456789ABC012GHI345JKL678MNO901PQR234STU567VWX890YZ',
    vote: 'For',
    weight: 1250,
    timestamp: NOW - 5 * DAY,
  },
];

/**
 * Fetch governance voting history for a specific address.
 * Derived from VoteCast events.
 */
export async function fetchVotesForAddress(address: string): Promise<VoteCastEvent[]> {
  await new Promise((r) => setTimeout(r, 400));
  // In a real implementation, we would filter contract events by the voter address.
  // For the mock, we return data if the address matches our mock voter.
  if (address === 'GABC123EXAMPLE456789ABC012GHI345JKL678MNO901PQR234STU567VWX890YZ') {
    return [...MOCK_VOTES].sort((a, b) => b.timestamp - a.timestamp);
  }
  return [];
}

// ─── Proposal Simulation / Dry-Run ────────────────────────────────────────────

export interface ProposalSimulationResult {
  isContractVerified: boolean;
  estimatedEffect: string;
  warnings?: string[];
}

/**
 * Simulate the effect of a proposed parameter change without executing it.
 * If the contract's `simulate_proposal_effect` function is available, returns
 * a contract-verified simulation. Otherwise, returns a client-side estimate with
 * a clear disclaimer.
 *
 * @param payload - The proposal payload to simulate
 * @returns Simulation result with effect description and verification status
 */
export async function simulateProposalEffect(
  payload: CreateProposalPayload
): Promise<ProposalSimulationResult> {
  try {
    // Attempt to call the contract's `simulate_proposal_effect` function
    // TODO: Wire this to actual Soroban call once contract function is available
    // Ref: #111
    const tx = buildGovernanceReadTransaction('simulate_proposal_effect', [
      // Would pass serialized payload to contract
    ]);

    const callResult = await server.simulateTransaction(tx);

    // If contract call succeeds, return verified result
    if (rpc.Api.isSimulationSuccess(callResult) && callResult.result?.retval) {
      const native = scValToNative(callResult.result.retval);
      return {
        isContractVerified: true,
        estimatedEffect: typeof native === 'string' ? native : JSON.stringify(native),
      };
    }

    // Fall through to client-side estimate
    console.warn('Contract simulate_proposal_effect not available, using client-side estimate');
  } catch (err) {
    console.warn('simulateProposalEffect contract call failed:', err);
    // Fall through to client-side estimate
  }

  // Client-side estimation (not contract-verified)
  const clientEstimate = generateClientSideEstimate(payload);
  return {
    isContractVerified: false,
    estimatedEffect: clientEstimate,
    warnings: [
      'This is an estimated preview, not contract-verified. Actual on-chain effect may differ due to updates between proposal creation and execution.',
    ],
  };
}

/**
 * Generate a client-side estimate of the proposal effect.
 * Used as fallback when contract simulation is unavailable.
 */
function generateClientSideEstimate(payload: CreateProposalPayload): string {
  switch (payload.formType) {
    case 'FeeRate':
      return `Update protocol fee rate to ${payload.newValueBps ? payload.newValueBps / 100 : 0}%`;
    case 'MaxDiscountRate':
      return `Update maximum discount rate to ${payload.newValueBps ? payload.newValueBps / 100 : 0}%`;
    case 'AddToken':
      return `Add ${payload.tokenName || 'new token'} (${payload.tokenAddress}) to accepted tokens`;
    case 'RemoveToken':
      return `Remove token (${payload.removeTokenAddress}) from accepted tokens`;
    default:
      return 'Proposal effect: unknown';
  }
}
