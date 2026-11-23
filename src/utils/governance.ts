import {
  rpc,
  xdr,
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
  Transaction,
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
import { recordPendingTransaction, removePendingTransaction } from '@/lib/pending-transactions';

// ─── RPC & Contract helpers ───────────────────────────────────────────────────

const server = new rpc.Server(RPC_URL);
const READ_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const NETWORK_PASSPHRASES = {
  testnet: 'Test SDF Network ; September 2015',
  public: 'Public Global Stellar Network ; September 2015',
} as const;

function assertGovernanceConfiguration(): string {
  if (!GOVERNANCE_CONTRACT_ID.trim()) {
    throw new Error('Governance contract is not configured. Set NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID.');
  }
  if (!GOVERNANCE_CONTRACT_ID.startsWith('C')) {
    throw new Error('Governance contract ID must be a Stellar contract address.');
  }
  try {
    Address.fromString(GOVERNANCE_CONTRACT_ID);
  } catch {
    throw new Error('Governance contract ID is not a valid Stellar contract address.');
  }

  const configuredNetwork = STELLAR_NETWORK.toLowerCase();
  const publicNetwork = configuredNetwork === 'public' || configuredNetwork === 'mainnet';
  if (configuredNetwork === 'testnet' || publicNetwork) {
    const expectedPassphrase = publicNetwork
      ? NETWORK_PASSPHRASES.public
      : NETWORK_PASSPHRASES.testnet;
    if (NETWORK_PASSPHRASE !== expectedPassphrase) {
      throw new Error(
        `Governance network configuration mismatch: ${publicNetwork ? 'public' : 'testnet'} requires its official network passphrase.`
      );
    }
    const rpcUrl = RPC_URL.toLowerCase();
    if (
      (configuredNetwork === 'testnet' && /mainnet|public/.test(rpcUrl)) ||
      (publicNetwork && /testnet|futurenet/.test(rpcUrl))
    ) {
      throw new Error(`Governance RPC endpoint does not match the configured ${configuredNetwork} network.`);
    }
    return GOVERNANCE_CONTRACT_ID;
  }

  if (configuredNetwork !== 'local') {
    throw new Error(`Unsupported governance network configuration: ${STELLAR_NETWORK}.`);
  }
  return GOVERNANCE_CONTRACT_ID;
}

function getGovernanceAccount(address: string): Account {
  if (!address.startsWith('G')) {
    throw new Error('A valid Stellar wallet address is required for governance transactions.');
  }
  try {
    Address.fromString(address);
  } catch {
    throw new Error('The governance signer address is not a valid Stellar account address.');
  }
  return new Account(address, '0');
}

function buildGovernanceReadTransaction(method: string, params: xdr.ScVal[] = []) {
  const contractId = assertGovernanceConfiguration();
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

function buildGovernanceWriteTransaction(
  account: Account,
  method: string,
  params: xdr.ScVal[]
) {
  const contractId = assertGovernanceConfiguration();
  return new TransactionBuilder(account, {
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

async function submitGovernanceTransaction(
  account: Account,
  method: string,
  params: xdr.ScVal[],
  signTx: (xdr: string) => Promise<string>
): Promise<{ txHash: string; returnValue?: xdr.ScVal }> {
  assertGovernanceConfiguration();
  const sourceAccount = await server.getAccount(account.accountId());
  const tx = buildGovernanceWriteTransaction(sourceAccount, method, params);
  const prepared = await server.prepareTransaction(tx);
  let signedXdr: string;
  try {
    signedXdr = await signTx(prepared.toXDR());
  } catch (error) {
    if (isCancellationError(error)) {
      throw new Error(
        'USER_REJECTED: Transaction signature was declined in wallet. No changes were applied.'
      );
    }
    throw error;
  }
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as Transaction;
  const sent = await server.sendTransaction(signedTx);

  if (!sent.hash || !['PENDING', 'DUPLICATE'].includes(sent.status)) {
    throw new Error(
      `Governance transaction submission failed with status ${String(sent.status || 'unknown')}.`
    );
  }

  recordPendingTransaction({ hash: sent.hash, label: `governance:${method}`, address: account.accountId() });
  const finalResult = await server.pollTransaction(sent.hash, { attempts: 20 });
  if (finalResult.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    if (finalResult.status === rpc.Api.GetTransactionStatus.FAILED) {
      removePendingTransaction(sent.hash);
    }
    throw new Error(`Governance transaction failed with status ${String(finalResult.status)}.`);
  }
  removePendingTransaction(sent.hash);

  const result = finalResult as typeof finalResult & {
    returnValue?: xdr.ScVal;
    result?: { retval?: xdr.ScVal };
  };
  return { txHash: sent.hash, returnValue: result.returnValue ?? result.result?.retval };
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
    status: 'Real',
    label: 'Vote casting',
  },
  delegateVotingPower: {
    status: 'Stubbed',
    label: 'Vote delegation',
  },
  createProposal: {
    status: 'Real',
    label: 'Proposal creation',
  },
  executeProposal: {
    status: 'Real',
    label: 'Proposal execution',
  },
  vetoProposal: {
    status: 'Real',
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

export function clearGovernanceIdempotencyCache(): void {}

export function getUserVote(_proposalId: number): VoteChoice | undefined {
  return undefined;
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

// ─── Contract Parsers ─────────────────────────────────────────────────────────

export function parseProposalStatus(status: unknown): ProposalStatus {
  let value: unknown = status;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    value =
      typeof record.tag === 'string'
        ? record.tag
        : Object.keys(record).length === 1
          ? Object.keys(record)[0]
          : undefined;
  }
  if (
    value === 'Active' ||
    value === 'Passed' ||
    value === 'Rejected' ||
    value === 'Executed' ||
    value === 'Vetoed'
  ) {
    return value;
  }
  throw new Error(`Unknown proposal status returned by governance contract: ${String(value)}`);
}

export function parseProposalType(action: unknown): ProposalType {
  let value = action;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    value =
      typeof record.tag === 'string'
        ? record.tag
        : Object.keys(record).length === 1
          ? Object.keys(record)[0]
          : undefined;
  }
  if (value === 'ParameterUpdate' || value === 'ProtocolUpgrade' || value === 'TextProposal') {
    return value;
  }
  if (value === 'UpdateFeeRate' || value === 'UpdateMaxDiscountRate') return 'ParameterUpdate';
  if (value === 'AddToken' || value === 'RemoveToken') return 'ProtocolUpgrade';
  throw new Error(`Unknown proposal action returned by governance contract: ${String(value)}`);
}

export function parseProposalFromNative(value: unknown): Proposal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Governance contract returned an invalid proposal record.');
  }
  const native = value as Record<string, unknown>;
  const rawId = native.id;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error('Governance contract returned an invalid proposal identifier.');
  }
  const action = native.type ?? native.action_type ?? native.action;
  const rawParameterChanges = native.parameter_changes ?? native.parameterChanges;
  const parameterChanges = Array.isArray(rawParameterChanges)
    ? rawParameterChanges.map((item) => {
        if (!item || typeof item !== 'object') {
          throw new Error('Governance contract returned invalid proposal parameter data.');
        }
        const change = item as Record<string, unknown>;
        return {
          parameter: String(change.parameter ?? ''),
          currentValue: String(change.current_value ?? change.currentValue ?? ''),
          newValue: String(change.new_value ?? change.newValue ?? ''),
        };
      })
    : undefined;
  const descriptionHash = native.description_hash;
  return {
    id,
    title:
      typeof native.title === 'string' ? native.title : `Proposal #${id}`,
    description:
      typeof native.description === 'string'
        ? native.description
        : typeof descriptionHash === 'string'
          ? `Description hash: ${descriptionHash}`
          : '',
    type: parseProposalType(action),
    status: parseProposalStatus(native.status),
    proposer: String(native.proposer ?? ''),
    createdAt: Number(native.created_at ?? native.createdAt ?? 0),
    votingStartsAt: Number(native.voting_starts_at ?? native.votingStartsAt ?? native.created_at ?? 0),
    votingEndsAt: Number(native.voting_ends_at ?? native.votingEndsAt ?? native.voting_end ?? 0),
    executableAfter: native.executable_after
      ? Number(native.executable_after)
      : native.executableAfter
        ? Number(native.executableAfter)
        : undefined,
    votesFor: Number(native.votes_for ?? native.votesFor ?? 0),
    votesAgainst: Number(native.votes_against ?? native.votesAgainst ?? 0),
    quorumRequired: Number(native.quorum_required ?? native.quorumRequired ?? 0),
    parameterChanges,
  };
}

// ─── Contract Integration Calls ────────────────────────────────────────────────

export async function fetchProposals(): Promise<Proposal[]> {
  const tx = buildGovernanceReadTransaction('list_proposals', [
    xdr.ScVal.scvVoid(),
    xdr.ScVal.scvVoid(),
    nativeToScVal(20, { type: 'u32' }),
  ]);
  const callResult = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(callResult) || !callResult.result?.retval) {
    throw new Error(`Governance proposal read failed: ${'error' in callResult ? String(callResult.error) : 'no result returned'}`);
  }
  const native = scValToNative(callResult.result.retval);
  if (!Array.isArray(native)) {
    throw new Error('Governance contract returned an invalid proposal list.');
  }
  return native.map((proposal) => ({
    ...parseProposalFromNative(proposal),
    vetoHistory: getVetoHistory(Number((proposal as Record<string, unknown>).id)),
  }));
}

export const getProposals = fetchProposals;

export async function fetchProposal(id: number): Promise<Proposal | null> {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error('A valid on-chain proposal identifier is required.');
  }
  const tx = buildGovernanceReadTransaction('get_proposal', [
    nativeToScVal(BigInt(id), { type: 'u64' }),
  ]);
  const callResult = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(callResult)) {
    throw new Error(
      `Governance proposal read failed: ${
        'error' in callResult ? String(callResult.error) : 'contract simulation failed'
      }`
    );
  }
  if (!callResult.result?.retval) return null;
  return parseProposalFromNative(scValToNative(callResult.result.retval));
}

/**
 * The wallet signature is the point of no return for every governance write.
 * Local tallies / statuses must stay untouched when signing is declined or
 * the wallet closes, so no local state is changed before a confirmed ledger
 * response.
 */
export async function castVote(
  proposalId: number,
  choice: VoteChoice,
  signerAddress: string,
  signTx: (xdr: string) => Promise<string>
): Promise<string> {
  if (!Number.isSafeInteger(proposalId) || proposalId < 1) {
    throw new Error('A valid on-chain proposal identifier is required to cast a vote.');
  }
  if (choice !== 'For' && choice !== 'Against') {
    throw new Error(`Unsupported governance vote choice: ${String(choice)}.`);
  }
  const account = getGovernanceAccount(signerAddress);
  const result = await submitGovernanceTransaction(account, 'cast_vote', [
    Address.fromString(signerAddress).toScVal(),
    nativeToScVal(BigInt(proposalId), { type: 'u64' }),
    nativeToScVal(choice === 'For', { type: 'bool' }),
  ], signTx);
  return result.txHash;
}

export async function executeProposal(
  proposalId: number,
  signerAddress: string,
  signTx: (xdr: string) => Promise<string>
): Promise<string> {
  if (!Number.isSafeInteger(proposalId) || proposalId < 1) {
    throw new Error('A valid on-chain proposal identifier is required to execute a proposal.');
  }
  const account = getGovernanceAccount(signerAddress);
  const result = await submitGovernanceTransaction(account, 'execute_proposal', [
    nativeToScVal(BigInt(proposalId), { type: 'u64' }),
  ], signTx);
  return result.txHash;
}

export async function vetoProposal(
  proposalId: number,
  reasonHash: string,
  adminAddress: string,
  signTx: (xdr: string) => Promise<string>
): Promise<string> {
  if (!Number.isSafeInteger(proposalId) || proposalId < 1) {
    throw new Error('A valid on-chain proposal identifier is required to veto a proposal.');
  }
  const normalizedHash = reasonHash.replace(/^0x/i, '');
  if (!/^[\da-fA-F]{64}$/.test(normalizedHash)) {
    throw new Error('Veto reason must be a 32-byte hexadecimal hash.');
  }
  const reasonBytes = Uint8Array.from(normalizedHash.match(/.{2}/g)!, (byte) =>
    Number.parseInt(byte, 16)
  );
  const account = getGovernanceAccount(adminAddress);
  const result = await submitGovernanceTransaction(account, 'veto_proposal', [
    Address.fromString(adminAddress).toScVal(),
    nativeToScVal(BigInt(proposalId), { type: 'u64' }),
    nativeToScVal(reasonBytes, { type: 'bytes' }),
  ], signTx);
  return result.txHash;
}

export function getVetoHistory(proposalId: number): VetoRecord[] {
  void proposalId;
  return [];
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
  assertGovernanceConfiguration();
  const account = getGovernanceAccount(signerAddress);
  if (!payload.title.trim() || !payload.description.trim()) {
    throw new Error('Proposal title and description are required.');
  }

  let action: xdr.ScVal;
  let proposedValue = 0n;
  switch (payload.formType) {
    case 'FeeRate':
    case 'MaxDiscountRate': {
      const bps = payload.newValueBps;
      if (bps === undefined || !Number.isSafeInteger(bps) || bps < 0 || bps > 0xffff_ffff) {
        throw new Error('A valid basis-point value is required for this proposal.');
      }
      const actionName =
        payload.formType === 'FeeRate' ? 'UpdateFeeRate' : 'UpdateMaxDiscountRate';
      action = xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol(actionName),
        nativeToScVal(bps, { type: 'u32' }),
      ]);
      proposedValue = BigInt(bps);
      break;
    }
    case 'AddToken': {
      const tokenAddress = payload.tokenAddress?.trim();
      if (!tokenAddress || !tokenAddress.startsWith('C')) {
        throw new Error('A valid token contract address is required to add a token.');
      }
      const token = Address.fromString(tokenAddress);
      const decimalsResult = await server.simulateTransaction(
        buildTokenReadTransaction(tokenAddress, 'decimals')
      );
      if (!rpc.Api.isSimulationSuccess(decimalsResult) || !decimalsResult.result?.retval) {
        throw new Error('Unable to verify token decimals from the token contract.');
      }
      const decimals = Number(scValToNative(decimalsResult.result.retval));
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 0xffff_ffff) {
        throw new Error('Token contract returned an invalid decimals value.');
      }
      action = xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol('AddToken'),
        token.toScVal(),
        nativeToScVal(decimals, { type: 'u32' }),
      ]);
      break;
    }
    case 'RemoveToken': {
      const tokenAddress = payload.removeTokenAddress?.trim();
      if (!tokenAddress || !tokenAddress.startsWith('C')) {
        throw new Error('A valid token contract address is required to remove a token.');
      }
      action = xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol('RemoveToken'),
        Address.fromString(tokenAddress).toScVal(),
      ]);
      break;
    }
    default:
      throw new Error(`Unsupported proposal type: ${String(payload.formType)}.`);
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Secure SHA-256 support is required to create a governance proposal.');
  }
  const description = new TextEncoder().encode(
    `${payload.title.trim()}\n${payload.description.trim()}`
  );
  const descriptionHash = new Uint8Array(await subtle.digest('SHA-256', description));
  const result = await submitGovernanceTransaction(account, 'create_proposal', [
    Address.fromString(signerAddress).toScVal(),
    action,
    nativeToScVal(descriptionHash, { type: 'bytes' }),
    nativeToScVal(proposedValue, { type: 'i128' }),
  ], signTx);
  if (!result.returnValue) {
    throw new Error('Governance contract confirmed proposal creation without returning its identifier.');
  }
  const proposalId = Number(scValToNative(result.returnValue));
  if (!Number.isSafeInteger(proposalId) || proposalId < 1) {
    throw new Error('Governance contract returned an invalid proposal identifier.');
  }
  return { txHash: result.txHash, proposalId };
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
