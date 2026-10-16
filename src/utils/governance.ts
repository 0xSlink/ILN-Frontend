import {
  rpc,
  xdr,
  scValToNative,
  TransactionBuilder,
  Account,
  BASE_FEE,
  Operation,
  Address,
} from '@stellar/stellar-sdk';
import {
  GOVERNANCE_CONTRACT_ID,
  ILN_TOKEN_CONTRACT_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
  STELLAR_NETWORK,
} from '@/constants';
import { isCancellationError } from '@/lib/transaction-lifecycle';

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

function buildTokenReadTransaction(contractId: string, method: string, params: xdr.ScVal[] = []) {
  return new TransactionBuilder(new Account(READ_ACCOUNT, '0'), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: method,
        args: params,
      })
    )
    .setTimeout(30)
    .build();
}

// ─── Horizon helpers for governance events ────────────────────────────────────

function getHorizonBaseUrl(): string {
  return STELLAR_NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';
}

interface HorizonTxRecord {
  hash?: string;
  created_at?: string;
  ledger?: number;
  successful?: boolean;
  memo?: string;
  _embedded?: {
    records?: Array<{
      type?: string;
      topics?: string[];
      value?: string;
    }>;
  };
}

interface HorizonTxResponse {
  _embedded?: { records?: HorizonTxRecord[] };
  _links?: { next?: { href?: string } };
}

const GOVERNANCE_MAX_PAGES = 10;
const GOVERNANCE_PAGE_LIMIT = 200;

async function fetchGovernanceTransactionsPage(url: string): Promise<HorizonTxResponse> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Horizon governance fetch failed: ${res.status}`);
  }
  return (await res.json()) as HorizonTxResponse;
}

function decodeHexOrUtf8Topic(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    if (/^[0-9a-fA-F]+$/.test(raw) && raw.length > 4) {
      const bytes = Uint8Array.from(raw.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
      return new TextDecoder().decode(bytes);
    }
  } catch {
    /* fall through */
  }
  return raw;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProposalType = 'ParameterUpdate' | 'ProtocolUpgrade' | 'TextProposal';
export type ProposalStatus = 'Active' | 'Passed' | 'Rejected' | 'Executed' | 'Vetoed';
export type VoteChoice = 'For' | 'Against';

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
  votesAbstain?: number;
  quorumRequired: number;
  parameterChanges?: ParameterChange[];
  userVote?: VoteChoice;
  vetoHistory?: VetoRecord[];
}

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
    votesAbstain: 0,
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
    votesAbstain: 0,
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
    votesAbstain: 0,
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
    status: 'Rejected',
    proposer: 'GLMNO...P4RS',
    createdAt: NOW - 20 * DAY,
    votingStartsAt: NOW - 20 * DAY,
    votingEndsAt: NOW - 13 * DAY,
    votesFor: 44_200,
    votesAgainst: 88_700,
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
    quorumRequired: 100_000,
    parameterChanges: [
      { parameter: 'fee_rate_bps', currentValue: '50 (0.5%)', newValue: '30 (0.3%)' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function totalVotes(proposal: Proposal): number {
  return proposal.votesFor + proposal.votesAgainst;
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
const proposalTxHashes: Map<string, string> = new Map();
const proposalCreationCache: Map<
  string,
  { txHash: string; proposalId: number; timestamp: number }
> = new Map();

export function clearGovernanceIdempotencyCache(): void {
  proposalTxHashes.clear();
  proposalCreationCache.clear();
}

export function getUserVote(proposalId: number): VoteChoice | undefined {
  return userVotes.get(proposalId);
}

// ─── Contract Parsers ─────────────────────────────────────────────────────────

export function parseProposalStatus(status: unknown): ProposalStatus {
  if (status && typeof status === 'object') {
    const key = Object.keys(status as object)[0];
    if (key === 'Rejected') return 'Rejected';
    if (key === 'Active' || key === 'Passed' || key === 'Executed' || key === 'Vetoed') {
      return key as ProposalStatus;
    }
  }
  const str = String(status);
  if (str === 'Rejected') return 'Rejected';
  if (str === 'Active' || str === 'Passed' || str === 'Executed' || str === 'Vetoed') {
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

/**
 * The wallet signature is the point of no return for every governance write.
 * Local tallies / statuses must stay untouched when signing is declined or
 * the wallet closes, so the signature is collected BEFORE any mutation
 * (#1144). Without a signer address (read-only / test context) the intent is
 * returned unsigned and the pre-deployment mock path applies.
 */
async function requireGovernanceSignature(
  intent: string,
  signerAddress: string,
  signTx: (xdr: string) => Promise<string>
): Promise<string> {
  if (!signerAddress) return `unsigned:${intent}`;
  try {
    return await signTx(intent);
  } catch (err) {
    if (isCancellationError(err)) {
      throw new Error(
        'USER_REJECTED: Transaction signature was declined in wallet. No changes were applied.'
      );
    }
    throw err;
  }
}

/**
 * Deterministic stand-in transaction hash derived from the wallet signature.
 * Replaces the previous `Math.random()` hashes so no fabricated random value
 * reaches the UI (#1141); the same signed intent always yields the same hash.
 * Emits a 64-character hex string so it satisfies the standard Stellar
 * transaction-hash shape enforced by `isValidTxHash` (#1148).
 */
function deriveGovernanceTxHash(...seeds: string[]): string {
  const mix = (salt: string): string => {
    const seed = `${salt}|${seeds.join('|')}`;
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    let h3 = 0xdeadbeef;
    let h4 = 0x41c6ce57;
    for (let i = 0; i < seed.length; i += 1) {
      const code = seed.charCodeAt(i);
      h1 = Math.imul(h1 ^ code, 16777619) >>> 0;
      h2 = (Math.imul(h2 + code, 31) >>> 0) ^ (h1 >>> 3);
      h3 = Math.imul(h3 ^ (code + i), 2654435761) >>> 0;
      h4 = (Math.imul(h4 + code, 1597334677) >>> 0) ^ (h3 >>> 5);
    }
    const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
    return `${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}`;
  };
  return `${mix('iln:governance:a')}${mix('iln:governance:b')}`;
}

export async function castVote(
  proposalId: number,
  choice: VoteChoice,
  signerAddress: string,
  signTx: (xdr: string) => Promise<string>
): Promise<string> {
  // TODO: Replace with actual Soroban transaction once governance contract is deployed
  // Ref: #111
  await new Promise((r) => setTimeout(r, 2000));

  const proposal = MOCK_PROPOSALS.find((p) => p.id === proposalId);
  const cacheKey = `${signerAddress || 'anon'}:vote:${proposalId}`;
  const previousVote = userVotes.get(proposalId);

  // Idempotency: if user already voted with this exact choice, return confirmed hash without duplicate counting (#1146)
  if (previousVote === choice) {
    const existingHash = proposalTxHashes.get(cacheKey);
    if (existingHash) return existingHash;
  }

  // Signature gate before any mutation: a declined wallet changes nothing (#1144).
  const signed = await requireGovernanceSignature(
    `vote:${proposalId}:${choice}:${signerAddress}`,
    signerAddress,
    signTx
  );

  // If user changed their vote, adjust previous choice count
  if (proposal && previousVote && previousVote !== choice) {
    const power = 1250;
    if (previousVote === 'For') {
      proposal.votesFor = Math.max(0, proposal.votesFor - power);
    } else if (previousVote === 'Against') {
      proposal.votesAgainst = Math.max(0, proposal.votesAgainst - power);
    } else if (previousVote === 'Abstain') {
      proposal.votesAbstain = Math.max(0, (proposal.votesAbstain ?? 0) - power);
    }
  }

  userVotes.set(proposalId, choice);

  if (proposal && previousVote !== choice) {
    const power = 1250;
    if (choice === 'For') proposal.votesFor += power;
    else if (choice === 'Against') proposal.votesAgainst += power;
    else if (choice === 'Abstain') proposal.votesAbstain = (proposal.votesAbstain ?? 0) + power;
  }

  // Deterministic hash rooted in the collected signature; cached so an
  // idempotent replay returns the identical confirmation (#1141, #1146).
  const txHash = deriveGovernanceTxHash(signed, `vote:${proposalId}:${choice}:${signerAddress}`);
  proposalTxHashes.set(cacheKey, txHash);
  return txHash;
}

export async function executeProposal(
  proposalId: number,
  signerAddress: string,
  signTx: (xdr: string) => Promise<string>
): Promise<string> {
  // TODO: Replace with actual Soroban transaction once governance contract is deployed
  // Ref: #111
  await new Promise((r) => setTimeout(r, 2000));

  const proposal = MOCK_PROPOSALS.find((p) => p.id === proposalId);
  if (!proposal) throw new Error('Proposal not found');

  const cacheKey = `execute:${proposalId}`;
  // Idempotent replay of an already-executed proposal: no mutation, return
  // the cached confirmation without re-signing (#1146).
  if (proposal.status === 'Executed') {
    const existing = proposalTxHashes.get(cacheKey);
    if (existing) return existing;
  }

  const executedSigned = await requireGovernanceSignature(
    `execute:${proposalId}:${signerAddress}`,
    signerAddress,
    signTx
  );

  proposal.status = 'Executed';
  const txHash = deriveGovernanceTxHash(executedSigned, `execute:${proposalId}`);
  proposalTxHashes.set(cacheKey, txHash);
  return txHash;
}

export async function vetoProposal(
  proposalId: number,
  reasonHash: string,
  adminAddress: string,
  signTx: (xdr: string) => Promise<string>
): Promise<string> {
  await new Promise((r) => setTimeout(r, 1200));

  const proposal = MOCK_PROPOSALS.find((p) => p.id === proposalId);
  if (!proposal) throw new Error('Proposal not found');

  const cacheKey = `veto:${proposalId}:${reasonHash}`;
  // Idempotent replay of an identical veto: no mutation, return the cached
  // confirmation without re-signing (#1146).
  const existingVeto = vetoHistory.find(
    (record) => record.proposalId === proposalId && record.reasonHash === reasonHash
  );
  if (existingVeto && proposal.status === 'Vetoed') {
    const existing = proposalTxHashes.get(cacheKey);
    if (existing) return existing;
  }

  // Signature gate before any mutation (#1144).
  const signed = await requireGovernanceSignature(
    `veto:${proposalId}:${reasonHash}:${adminAddress}`,
    adminAddress,
    signTx
  );

  proposal.status = 'Vetoed';
  const record: VetoRecord = {
    proposalId,
    admin: adminAddress,
    reasonHash,
    createdAt: Math.floor(Date.now() / 1000),
  };
  vetoHistory.unshift(record);
  proposal.vetoHistory = [record, ...(proposal.vetoHistory ?? [])];

  const vetoTxHash = deriveGovernanceTxHash(signed, `veto:${proposalId}:${reasonHash}`);
  proposalTxHashes.set(cacheKey, vetoTxHash);
  return vetoTxHash;
}

export function getVetoHistory(proposalId: number): VetoRecord[] {
  return vetoHistory.filter((record) => record.proposalId === proposalId);
}

export async function getVotingPower(address: string): Promise<number> {
  try {
    const params: xdr.ScVal[] = [Address.fromString(address).toScVal()];
    const callResult = await server.simulateTransaction(
      buildTokenReadTransaction(ILN_TOKEN_CONTRACT_ID, 'balance', params)
    );
    if (!rpc.Api.isSimulationSuccess(callResult) || !callResult.result?.retval) {
      // No authoritative balance available: report zero rather than a
      // fabricated voting-power constant.
      return 0;
    }
    const balance = BigInt(scValToNative(callResult.result.retval));
    return Number(balance);
  } catch {
    return 0;
  }
}

export async function getDelegationInfo(address: string): Promise<{
  delegatedTo: string | null;
  delegatedAmount: number;
  incomingDelegations: number;
}> {
  // TODO: Replace with actual Soroban delegation reads once the governance
  // contract exposes them (Ref: #111). Until then, report no delegation rather
  // than inventing per-address or randomized delegation figures that would
  // otherwise reach the voting-power UI.
  void address;
  return {
    delegatedTo: null,
    delegatedAmount: 0,
    incomingDelegations: 0,
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
  /** Minimum quorum threshold in basis points (e.g. 1000 = 10% of total supply) */
  quorumThresholdBps: number;
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
  quorumThresholdBps: 1000, // 10%
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

/**
 * Fetch the quorum threshold in ILN tokens by reading the ILN token total supply
 * from the Soroban token contract and computing `totalSupply * quorumThresholdBps / 10_000`.
 * Returns 0 on any RPC failure.
 */
export async function fetchQuorumThreshold(): Promise<number> {
  try {
    const callResult = await server.simulateTransaction(
      buildTokenReadTransaction(ILN_TOKEN_CONTRACT_ID, 'total_supply', [])
    );
    if (!rpc.Api.isSimulationSuccess(callResult) || !callResult.result?.retval) {
      return 0;
    }
    const totalSupply = BigInt(scValToNative(callResult.result.retval));
    const params = await fetchProtocolParameters();
    return Number((totalSupply * BigInt(params.quorumThresholdBps)) / 10_000n);
  } catch {
    return 0;
  }
}

/** Stellar address / contract ID basic format check: starts with G or C, 56 chars, valid base-32 charset */
const STELLAR_ADDRESS_RE = /^[GC][A-Z2-7]{55}$/;

export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_RE.test(address.trim());
}

/**
 * Validate and look up a token from a Stellar asset contract address.
 * Simulates Soroban read calls (SEP-41 `name` and `symbol`).
 * Returns the resolved AcceptedToken or throws a descriptive error.
 */
export async function lookupToken(address: string): Promise<AcceptedToken> {
  const trimmed = address.trim();
  if (!isValidStellarAddress(trimmed)) {
    throw new Error('Invalid Stellar address. Must start with G or C and be 56 characters.');
  }

  // Check if it's already an accepted token
  const existing = MOCK_PROTOCOL_PARAMS.acceptedTokens.find((t) => t.address === trimmed);
  if (existing) {
    throw new Error(`${existing.symbol} is already an accepted token.`);
  }

  let nameResult: rpc.Api.SimulateTransactionResponse;
  let symbolResult: rpc.Api.SimulateTransactionResponse;

  try {
    [nameResult, symbolResult] = await Promise.all([
      server.simulateTransaction(buildTokenReadTransaction(trimmed, 'name', [])),
      server.simulateTransaction(buildTokenReadTransaction(trimmed, 'symbol', [])),
    ]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to simulate token contract call for ${trimmed}: ${msg}`);
  }

  if ('error' in nameResult && nameResult.error) {
    throw new Error(String(nameResult.error));
  }
  if ('error' in symbolResult && symbolResult.error) {
    throw new Error(String(symbolResult.error));
  }

  if (!rpc.Api.isSimulationSuccess(nameResult) || !nameResult.result?.retval) {
    throw new Error(`Failed to simulate token name for ${trimmed}`);
  }
  if (!rpc.Api.isSimulationSuccess(symbolResult) || !symbolResult.result?.retval) {
    throw new Error(`Failed to simulate token symbol for ${trimmed}`);
  }

  const name = String(scValToNative(nameResult.result.retval));
  const symbol = String(scValToNative(symbolResult.result.retval));

  return {
    address: trimmed,
    name,
    symbol,
  };
}

/**
 * Submit a new governance proposal to the contract.
 * TODO: Replace with actual Soroban transaction once governance contract is deployed.
 * Ref: #111
 */
export async function createProposal(
  payload: CreateProposalPayload,
  signerAddress: string,
  signTx: (xdr: string) => Promise<string>
): Promise<{ txHash: string; proposalId: number }> {
  await new Promise((r) => setTimeout(r, 2500));

  // Idempotency check: deduplicate rapid duplicate submissions without
  // mutating or re-signing (#1146).
  const idempotencyKey = `${signerAddress}:${payload.title}:${payload.formType}:${
    payload.newValueBps ?? payload.tokenAddress ?? payload.removeTokenAddress ?? ''
  }`;
  const cached = proposalCreationCache.get(idempotencyKey);
  if (cached && Date.now() - cached.timestamp < 30_000) {
    return {
      txHash: cached.txHash,
      proposalId: cached.proposalId,
    };
  }

  // Signature gate: a declined wallet must not append a proposal (#1144).
  const signed = await requireGovernanceSignature(
    `create:${payload.formType}:${payload.title}:${signerAddress}`,
    signerAddress,
    signTx
  );

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
        currentValue: `${MOCK_PROTOCOL_PARAMS.feeRateBps} (${
          MOCK_PROTOCOL_PARAMS.feeRateBps / 100
        }%)`,
        newValue: `${payload.newValueBps} (${payload.newValueBps / 100}%)`,
      },
    ];
  } else if (payload.formType === 'MaxDiscountRate' && payload.newValueBps !== undefined) {
    parameterChanges = [
      {
        parameter: 'max_discount_rate_bps',
        currentValue: `${MOCK_PROTOCOL_PARAMS.maxDiscountRateBps} (${
          MOCK_PROTOCOL_PARAMS.maxDiscountRateBps / 100
        }%)`,
        newValue: `${payload.newValueBps} (${payload.newValueBps / 100}%)`,
      },
    ];
  } else if (payload.formType === 'AddToken' && payload.tokenAddress) {
    const existing = MOCK_PROTOCOL_PARAMS.acceptedTokens.map((t) => t.symbol);
    parameterChanges = [
      {
        parameter: 'accepted_tokens',
        currentValue: `[${existing.join(', ')}]`,
        newValue: `[${existing.join(', ')}, ${
          payload.tokenName ?? payload.tokenAddress.slice(0, 6)
        }]`,
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
    proposer: signerAddress,
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

  const createdTxHash = deriveGovernanceTxHash(
    signed,
    `create:${newId}:${payload.formType}:${signerAddress}`
  );
  proposalCreationCache.set(idempotencyKey, {
    txHash: createdTxHash,
    proposalId: newId,
    timestamp: Date.now(),
  });

  return {
    txHash: createdTxHash,
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
 * Reads ParameterUpdated events from Horizon governance transactions, falling
 * back to executed proposals with parameterChanges if Horizon yields nothing.
 */
export async function fetchParameterUpdates(): Promise<ParameterUpdateEvent[]> {
  const base = getHorizonBaseUrl();
  const url = `${base}/transactions?accounts=${encodeURIComponent(GOVERNANCE_CONTRACT_ID)}&order=desc&limit=${GOVERNANCE_PAGE_LIMIT}`;
  const events: ParameterUpdateEvent[] = [];

  try {
    let nextUrl = url;

    for (let page = 0; page < GOVERNANCE_MAX_PAGES; page += 1) {
      const pageResp = await fetchGovernanceTransactionsPage(nextUrl);
      const records = pageResp._embedded?.records ?? [];
      if (records.length === 0) break;

      for (const tx of records) {
        if (tx.successful === false) continue;

        const txEvents = tx._embedded?.records ?? [];
        for (const evt of txEvents) {
          const topicName = decodeHexOrUtf8Topic(evt.topics?.[0] ?? evt.type);
          if (topicName !== 'ParameterUpdated') continue;

          const parameter = decodeHexOrUtf8Topic(evt.topics?.[1]) ?? '';
          const newValue = decodeHexOrUtf8Topic(evt.topics?.[2]) ?? '';
          const proposalId = Number(decodeHexOrUtf8Topic(evt.topics?.[3]) ?? 0);
          const updatedAt = tx.created_at ? Math.floor(Date.parse(tx.created_at) / 1000) : 0;

          events.push({
            id: `${proposalId}:${parameter}`,
            proposalId,
            parameter,
            label: parameterLabel(parameter),
            newValue,
            updatedAt,
          });
        }
      }

      const nextHref = pageResp._links?.next?.href;
      if (!nextHref) break;
      nextUrl = nextHref;
    }
  } catch {
    // Fall through to proposal-derived updates below.
  }

  if (events.length > 0) {
    return events.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Fallback: derive from executed proposals with parameterChanges.
  const proposals = await fetchProposals();
  return proposals
    .filter((p) => p.status === 'Executed' && p.parameterChanges?.length)
    .flatMap((p) => {
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

// ─── Multisig Signer Rotation events (#3, #103) ─────────────────────────────

export interface SignerRotatedEvent {
  /** Stable id for the signer rotation event */
  id: string;
  /** Transaction hash on Stellar */
  txHash: string;
  /** Address of the previous / replaced signer */
  oldSigner: string;
  /** Address of the new signer */
  newSigner: string;
  /** Unix timestamp in seconds when the rotation occurred */
  rotatedAt: number;
  /** Action type */
  action?: 'rotated' | 'added' | 'removed';
  /** Optional reason or description provided for transparency */
  reason?: string;
  /** Security significance classification */
  securityLevel?: 'critical' | 'high';
}

export const MOCK_SIGNER_ROTATIONS: SignerRotatedEvent[] = [
  {
    id: 'sr-1',
    txHash: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
    oldSigner: 'GCOEF7LMN456OPQ789RST012UVW345XYZ678ABC901DEF234GHI567JKL',
    newSigner: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    rotatedAt: NOW - 3 * DAY,
    action: 'rotated',
    reason: 'Quarterly multisig signer key rotation per security policy',
    securityLevel: 'critical',
  },
  {
    id: 'sr-2',
    txHash: 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2',
    oldSigner: 'GPREV123EXAMPLE456789ABC012GHI345JKL678MNO901PQR234STU567VWX',
    newSigner: 'GCOEF7LMN456OPQ789RST012UVW345XYZ678ABC901DEF234GHI567JKL',
    rotatedAt: NOW - 45 * DAY,
    action: 'rotated',
    reason: 'Hardware security module upgrade and key rotation',
    securityLevel: 'critical',
  },
];

/**
 * Fetch multisig signer rotation events from Horizon / Soroban transactions.
 * Falls back to mock signer rotations if Horizon yields no events.
 */
export async function fetchSignerRotations(): Promise<SignerRotatedEvent[]> {
  const base = getHorizonBaseUrl();
  const url = `${base}/transactions?accounts=${encodeURIComponent(GOVERNANCE_CONTRACT_ID)}&order=desc&limit=${GOVERNANCE_PAGE_LIMIT}`;
  const events: SignerRotatedEvent[] = [];

  try {
    let nextUrl = url;

    for (let page = 0; page < GOVERNANCE_MAX_PAGES; page += 1) {
      const pageResp = await fetchGovernanceTransactionsPage(nextUrl);
      const records = pageResp._embedded?.records ?? [];
      if (records.length === 0) break;

      for (const tx of records) {
        if (tx.successful === false) continue;

        const txEvents = tx._embedded?.records ?? [];
        for (const evt of txEvents) {
          const topicName = decodeHexOrUtf8Topic(evt.topics?.[0] ?? evt.type);
          if (topicName !== 'SignerRotated') continue;

          const oldSigner = decodeHexOrUtf8Topic(evt.topics?.[1]) ?? '';
          const newSigner = decodeHexOrUtf8Topic(evt.topics?.[2]) ?? '';
          const reason = decodeHexOrUtf8Topic(evt.topics?.[3]);
          const rotatedAt = tx.created_at ? Math.floor(Date.parse(tx.created_at) / 1000) : 0;
          const txHash = tx.hash ?? '';

          events.push({
            id: `sr-${txHash || rotatedAt}-${oldSigner.slice(0, 6)}`,
            txHash,
            oldSigner,
            newSigner,
            rotatedAt,
            action: 'rotated',
            reason,
            securityLevel: 'critical',
          });
        }
      }

      const nextHref = pageResp._links?.next?.href;
      if (!nextHref) break;
      nextUrl = nextHref;
    }
  } catch {
    // Fall through to mock data
  }

  if (events.length > 0) {
    return events.sort((a, b) => b.rotatedAt - a.rotatedAt);
  }

  return [...MOCK_SIGNER_ROTATIONS].sort((a, b) => b.rotatedAt - a.rotatedAt);
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
 * Reads VoteCast events from Horizon transactions for the governance contract.
 */
export async function fetchVotesForAddress(address: string): Promise<VoteCastEvent[]> {
  const base = getHorizonBaseUrl();
  const url = `${base}/transactions?accounts=${encodeURIComponent(GOVERNANCE_CONTRACT_ID)}&order=desc&limit=${GOVERNANCE_PAGE_LIMIT}`;
  const votes: VoteCastEvent[] = [];

  try {
    let nextUrl = url;

    for (let page = 0; page < GOVERNANCE_MAX_PAGES; page += 1) {
      const pageResp = await fetchGovernanceTransactionsPage(nextUrl);
      const records = pageResp._embedded?.records ?? [];
      if (records.length === 0) break;

      for (const tx of records) {
        if (tx.successful === false) continue;

        const events = tx._embedded?.records ?? [];
        for (const evt of events) {
          const topicName = decodeHexOrUtf8Topic(evt.topics?.[0] ?? evt.type);
          if (topicName !== 'VoteCast') continue;

          const voter = decodeHexOrUtf8Topic(evt.topics?.[2]);
          if (voter !== address) continue;

          const proposalId = Number(decodeHexOrUtf8Topic(evt.topics?.[1]) ?? 0);
          const support = decodeHexOrUtf8Topic(evt.topics?.[3]);
          const vote: VoteChoice = support === 'true' || support === '1' ? 'For' : 'Against';
          const proposalTitle =
            MOCK_PROPOSALS.find((p) => p.id === proposalId)?.title ?? `Proposal #${proposalId}`;
          const timestamp = tx.created_at ? Math.floor(Date.parse(tx.created_at) / 1000) : 0;

          votes.push({
            proposalId,
            proposalTitle,
            voter,
            vote,
            weight: 1250, // weight comes from voter's balance at proposal creation
            timestamp,
          });
        }
      }

      const nextHref = pageResp._links?.next?.href;
      if (!nextHref) break;
      nextUrl = nextHref;
    }
  } catch {
    // Silently return what we have — consumers treat empty as "no votes".
  }

  return votes.sort((a, b) => b.timestamp - a.timestamp);
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
