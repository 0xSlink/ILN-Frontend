/**
 * Signed Soroban transaction pipeline for governance mutations (#1044, #1045).
 *
 * Every governance write goes through one path:
 *
 *   preflight → simulate → sign → submit → bounded confirmation poll
 *
 * Two properties this module exists to guarantee:
 *
 * 1. **Nothing reaches the wallet unsimulated (#1044).** Simulation runs
 *    before `signTx`, and a failed simulation is classified into an
 *    actionable code (authorization, resource/budget, archived state,
 *    contract error, missing entry point) instead of a raw `HostError`
 *    string. The user finds out *why* an action is impossible before being
 *    asked to approve it, and the wallet is never prompted for a transaction
 *    that cannot succeed.
 *
 * 2. **Confirmation is bounded, and a timeout is not a failure (#1045).**
 *    Polling stops at both an attempt count and a wall-clock deadline. The
 *    three outcomes stay distinct:
 *
 *    | Outcome   | Meaning                        | On-chain effect    | Pending entry |
 *    | --------- | ------------------------------ | ------------------ | ------------- |
 *    | confirmed | RPC reported SUCCESS           | applied            | removed       |
 *    | failed    | RPC reported FAILED            | rejected on-chain  | removed       |
 *    | rejected  | signature declined in wallet   | never submitted    | never created |
 *    | timeout   | still NOT_FOUND at the bound   | **unknown**        | kept          |
 *
 *    A timeout means "we stopped waiting", never "it failed". The submitted
 *    hash is still live until its time bound expires, so the pending entry is
 *    deliberately kept for {@link reconcilePendingTransactions} and the error
 *    carries `resubmitSafe: false` — re-signing a governance vote whose
 *    outcome is unknown risks double-voting.
 *
 * ## Replay and stale-state rules (#1323)
 *
 * The contract is the final authority; these client checks stop a doomed or
 * duplicate transaction from reaching the wallet.
 *
 * | Case                         | Observable behavior                                  |
 * | ---------------------------- | ---------------------------------------------------- |
 * | Same operation, concurrent   | Callers share one transaction (`utils/governance`)   |
 * | Retry, earlier tx SUCCESS    | Returns the settled hash; nothing is signed          |
 * | Retry, earlier tx FAILED     | Pending entry cleared; a new attempt may proceed     |
 * | Retry, earlier tx unsettled  | `DUPLICATE_PENDING`, `resubmitSafe: false`           |
 * | Retry, RPC unreachable       | `DUPLICATE_PENDING`, `resubmitSafe: false`           |
 * | Earlier tx past its time bound | Entry released; simulation re-checks contract state |
 * | Send interrupted             | `TX_TIMEOUT` with the locally computed hash          |
 * | Before ETA, vetoed, or stale | `PROPOSAL_NOT_EXECUTABLE` before the wallet prompt   |
 *
 * The module owns no governance business logic: callers in
 * `src/utils/governance.ts` supply the method name and arguments, which keeps
 * the contract boundary in one place.
 */

import {
  rpc,
  xdr,
  Account,
  BASE_FEE,
  Operation,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import {
  GOVERNANCE_CONTRACT_CONFIGURED,
  GOVERNANCE_CONTRACT_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
} from '@/constants';
import { isCancellationError } from './transaction-lifecycle';
import {
  findPendingOperation,
  recordPendingTransaction,
  removePendingTransaction,
} from './pending-transactions';

const server = new rpc.Server(RPC_URL);

/**
 * Governance mutation entry points on `iln_governance`.
 *
 * `cast_vote(voter: address, proposal_id: u64, choice: u32)` is the shape
 * already pinned by the signing-preview allowlist
 * (`src/utils/transactionPattern.ts`) and by
 * `docs/frontend-mock-closure-audit.md`. The remaining three follow the same
 * convention — caller address first, then the proposal selector — and are
 * declared in {@link GOVERNANCE_MUTATION_ARITY} so a contract-side rename or
 * signature change is a one-line edit here rather than a hunt through
 * call sites (`sync:smart-contract`).
 */
export type GovernanceMutationMethod =
  | 'cast_vote'
  | 'create_proposal'
  | 'execute_proposal'
  | 'veto_proposal';

/**
 * Expected argument count per entry point, asserted before simulation so a
 * drifted call site fails here with a clear message rather than as an opaque
 * `HostError` from the host function.
 */
export const GOVERNANCE_MUTATION_ARITY: Record<GovernanceMutationMethod, number> = {
  /** `cast_vote(voter: address, proposal_id: u64, choice: u32)` */
  cast_vote: 3,
  /**
   * `create_proposal(proposer: address, kind: u32, title: string,
   * description: string, value: string)` — `value` carries the basis-point
   * figure for rate proposals or the token address for allowlist proposals.
   */
  create_proposal: 5,
  /** `execute_proposal(caller: address, proposal_id: u64)` */
  execute_proposal: 2,
  /** `veto_proposal(admin: address, proposal_id: u64, reason_hash: string)` */
  veto_proposal: 3,
};

// ─── Bounds (#1045) ───────────────────────────────────────────────────────────

/** Maximum confirmation polls before the attempt bound is reached. */
export const GOVERNANCE_CONFIRMATION_ATTEMPTS = 20;
/** Delay between confirmation polls. */
export const GOVERNANCE_CONFIRMATION_INTERVAL_MS = 1_500;
/**
 * Wall-clock bound, enforced alongside the attempt count. A slow RPC can make
 * 20 attempts take far longer than 20 × interval, so the deadline is what
 * actually caps how long a user waits.
 */
export const GOVERNANCE_CONFIRMATION_TIMEOUT_MS = 40_000;

/** Time bound set on every governance transaction. */
export const GOVERNANCE_TX_VALIDITY_SECONDS = 60;
/**
 * How long after recording an unsettled transaction its operation stays locked.
 * The transaction cannot apply after its time bound; the extra minute absorbs
 * ledger-close and client-clock differences.
 */
export const GOVERNANCE_PENDING_LOCK_MS = (GOVERNANCE_TX_VALIDITY_SECONDS + 60) * 1_000;
/**
 * Tolerance for comparing a chain ETA with the client clock. Inside this window
 * the contract simulation decides, so a skewed clock cannot block a valid call.
 */
export const GOVERNANCE_ETA_CLOCK_SKEW_SECONDS = 60;

/** Statuses `sendTransaction` may return for a transaction the network accepted. */
const ACCEPTED_SEND_STATUSES = new Set(['PENDING', 'DUPLICATE']);

// ─── Typed errors ─────────────────────────────────────────────────────────────

export type GovernanceTxErrorCode =
  /** No governance contract is configured, so no write can be built. */
  | 'CONTRACT_NOT_CONFIGURED'
  /** The configured contract exists but exposes no such entry point. */
  | 'ENTRYPOINT_MISSING'
  /** The signing account does not exist / is unfunded on this network. */
  | 'SOURCE_ACCOUNT_MISSING'
  /** Simulation rejected the required authorization. */
  | 'SIMULATION_UNAUTHORIZED'
  /** Simulation exceeded the resource/fee budget. */
  | 'SIMULATION_INSUFFICIENT_RESOURCES'
  /** Contract state is archived and must be restored first. */
  | 'SIMULATION_ARCHIVED_STATE'
  /** The proposal key does not exist in contract storage. */
  | 'PROPOSAL_NOT_FOUND'
  /** The contract returned a defined error code. */
  | 'SIMULATION_CONTRACT_ERROR'
  /** Simulation failed for an unclassified reason. */
  | 'SIMULATION_FAILED'
  /** Signature declined in the wallet; nothing was submitted. */
  | 'USER_REJECTED'
  /** The RPC server refused the submission outright. */
  | 'SUBMISSION_REJECTED'
  /** The network reported the transaction as failed. */
  | 'TX_FAILED'
  /** The confirmation bound was reached; the outcome is unknown. */
  | 'TX_TIMEOUT'
  /** An earlier transaction for this operation is still unsettled (#1323). */
  | 'DUPLICATE_PENDING'
  /** Fresh proposal state shows it cannot be executed now (#1323). */
  | 'PROPOSAL_NOT_EXECUTABLE'
  /** A mock-only action was attempted in a production build (#1320). */
  | 'MOCK_ACTION_BLOCKED';

/** Which stage of the pipeline produced the error. */
export type GovernanceTxPhase =
  | 'preflight'
  | 'simulation'
  | 'signing'
  | 'submission'
  | 'confirmation';

/**
 * Base error for every governance write failure.
 *
 * `remediation` is the user-facing next step and is what the toast renders;
 * `diagnostics` keeps the raw RPC text for the collapsible technical detail.
 */
export class GovernanceTxError extends Error {
  readonly code: GovernanceTxErrorCode;
  readonly phase: GovernanceTxPhase;
  readonly remediation: string;
  readonly method?: GovernanceMutationMethod;
  readonly diagnostics?: string;
  /** Settlement hash, when one exists (submission reached the network). */
  readonly txHash?: string;
  /**
   * Whether re-signing and re-submitting the same action is safe.
   *
   * False whenever the on-chain outcome is unknown: a second vote or
   * execution could be applied twice. Only states proven not to have landed
   * (declined signature, failed simulation) are safe to retry.
   */
  readonly resubmitSafe: boolean;

  constructor(options: {
    code: GovernanceTxErrorCode;
    phase: GovernanceTxPhase;
    message: string;
    remediation: string;
    method?: GovernanceMutationMethod;
    diagnostics?: string;
    txHash?: string;
    resubmitSafe?: boolean;
  }) {
    super(options.message);
    this.name = 'GovernanceTxError';
    this.code = options.code;
    this.phase = options.phase;
    this.remediation = options.remediation;
    this.method = options.method;
    this.diagnostics = options.diagnostics;
    this.txHash = options.txHash;
    this.resubmitSafe = options.resubmitSafe ?? false;
  }
}

/** Governance writes are impossible in this deployment (not configured / not deployed). */
export class GovernanceUnavailableError extends GovernanceTxError {
  constructor(options: {
    code: Extract<
      GovernanceTxErrorCode,
      | 'CONTRACT_NOT_CONFIGURED'
      | 'ENTRYPOINT_MISSING'
      | 'SOURCE_ACCOUNT_MISSING'
      | 'MOCK_ACTION_BLOCKED'
    >;
    message: string;
    remediation: string;
    method?: GovernanceMutationMethod;
    diagnostics?: string;
  }) {
    super({ ...options, phase: 'preflight', resubmitSafe: false });
    this.name = 'GovernanceUnavailableError';
  }
}

/** Simulation rejected the mutation before the wallet was ever prompted (#1044). */
export class GovernanceSimulationError extends GovernanceTxError {
  constructor(options: {
    code: GovernanceTxErrorCode;
    message: string;
    remediation: string;
    method?: GovernanceMutationMethod;
    diagnostics?: string;
  }) {
    // Nothing was signed or submitted, so retrying after the cause is fixed
    // cannot double-apply the action.
    super({ ...options, phase: 'simulation', resubmitSafe: true });
    this.name = 'GovernanceSimulationError';
  }
}

/** The signature was declined in the wallet; nothing reached the network. */
export class GovernanceSigningRejectedError extends GovernanceTxError {
  constructor(method?: GovernanceMutationMethod) {
    super({
      code: 'USER_REJECTED',
      phase: 'signing',
      method,
      message:
        'USER_REJECTED: Transaction signature was declined in wallet. No changes were applied.',
      remediation: 'Approve the transaction in your wallet to submit it.',
      resubmitSafe: true,
    });
    this.name = 'GovernanceSigningRejectedError';
  }
}

/** The network settled the transaction as failed — an explicit, final verdict. */
export class GovernanceTxFailedError extends GovernanceTxError {
  constructor(options: {
    message: string;
    remediation: string;
    method?: GovernanceMutationMethod;
    diagnostics?: string;
    txHash?: string;
    code?: Extract<GovernanceTxErrorCode, 'TX_FAILED' | 'SUBMISSION_REJECTED'>;
    phase?: Extract<GovernanceTxPhase, 'submission' | 'confirmation'>;
  }) {
    super({
      code: options.code ?? 'TX_FAILED',
      phase: options.phase ?? 'confirmation',
      message: options.message,
      remediation: options.remediation,
      method: options.method,
      diagnostics: options.diagnostics,
      txHash: options.txHash,
      // A settled failure applied nothing, so a corrected retry is safe.
      resubmitSafe: true,
    });
    this.name = 'GovernanceTxFailedError';
  }
}

/**
 * The confirmation bound was reached with the transaction still unsettled
 * (#1045). Distinct from {@link GovernanceTxFailedError}: the transaction may
 * yet confirm, so the outcome is unknown rather than negative.
 */
export class GovernanceTxTimeoutError extends GovernanceTxError {
  /** Polls performed before the bound was reached. */
  readonly attempts: number;
  /** Wall-clock milliseconds spent waiting. */
  readonly elapsedMs: number;

  constructor(options: {
    txHash: string;
    attempts: number;
    elapsedMs: number;
    method?: GovernanceMutationMethod;
  }) {
    const seconds = Math.round(options.elapsedMs / 1000);
    super({
      code: 'TX_TIMEOUT',
      phase: 'confirmation',
      method: options.method,
      message:
        `TX_TIMEOUT: transaction ${options.txHash} was still unconfirmed after ` +
        `${options.attempts} checks over ${seconds}s. It was submitted and may still confirm.`,
      remediation:
        'Your transaction was submitted and may still confirm. Check its status before ' +
        'trying again — submitting a second time could apply the action twice.',
      txHash: options.txHash,
      // The action may yet land. Never offer a blind retry.
      resubmitSafe: false,
    });
    this.name = 'GovernanceTxTimeoutError';
    this.attempts = options.attempts;
    this.elapsedMs = options.elapsedMs;
  }
}

/** True for a bounded-confirmation timeout, whose outcome is unknown (#1045). */
export function isGovernanceTimeoutError(error: unknown): error is GovernanceTxTimeoutError {
  return error instanceof GovernanceTxError && error.code === 'TX_TIMEOUT';
}

/** True when governance writes cannot be built at all in this deployment. */
export function isGovernanceUnavailableError(error: unknown): error is GovernanceUnavailableError {
  return error instanceof GovernanceUnavailableError;
}

// ─── Simulation-error classification (#1044) ─────────────────────────────────

/**
 * Entry point absent from the deployed WASM. This is what a contract without
 * governance support returns (`Error(WasmVm, MissingValue)`), so it is
 * reported as "governance unavailable" rather than as a user-fixable error.
 */
const ENTRYPOINT_MISSING_PATTERN =
  /WasmVm.*MissingValue|MissingValue.*WasmVm|non-existent (?:export|function)|missing (?:export|function)/i;

/** Required authorization absent or not satisfiable by the signing account. */
const UNAUTHORIZED_PATTERN =
  /Error\(Auth[,)]|InvalidAction|require_auth|unauthorized|not authorized|signature .*not .*valid/i;

/** Resource, budget, or fee limits exceeded. */
const RESOURCE_PATTERN =
  /Error\(Budget[,)]|ExceededLimit|Resource(?:Limit)?Exceeded|resource limit|exceeded .*(?:budget|limit)|insufficient refundable fee|too many (?:entries|operations)/i;

/** A key the contract expected in storage is absent — e.g. an unknown proposal id. */
const STORAGE_MISSING_PATTERN = /Error\(Storage, *MissingValue\)|MissingValue.*Storage/i;

/** A contract-defined error code, e.g. `Error(Contract, #7)`. */
const CONTRACT_ERROR_PATTERN = /Error\(Contract, *#?(\d+)\)/i;

/**
 * Maps a simulation failure onto an actionable error.
 *
 * Classification is deliberately ordered most-specific first: a missing entry
 * point and a missing storage key both surface as `MissingValue` and only the
 * error's subsystem (`WasmVm` vs `Storage`) tells them apart.
 */
export function classifyGovernanceSimulationError(
  rawError: string,
  method?: GovernanceMutationMethod
): GovernanceTxError {
  const diagnostics = rawError;

  if (ENTRYPOINT_MISSING_PATTERN.test(rawError)) {
    return new GovernanceUnavailableError({
      code: 'ENTRYPOINT_MISSING',
      method,
      message:
        `ENTRYPOINT_MISSING: contract ${GOVERNANCE_CONTRACT_ID} has no ` +
        `${method ?? 'governance'} entry point.`,
      remediation:
        'The configured contract does not implement governance. Point ' +
        'NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID at a deployed iln_governance contract.',
      diagnostics,
    });
  }

  if (STORAGE_MISSING_PATTERN.test(rawError)) {
    return new GovernanceSimulationError({
      code: 'PROPOSAL_NOT_FOUND',
      method,
      message: 'PROPOSAL_NOT_FOUND: the contract holds no record for this proposal.',
      remediation:
        'Reload the proposal list — this proposal does not exist on the configured contract.',
      diagnostics,
    });
  }

  if (UNAUTHORIZED_PATTERN.test(rawError)) {
    return new GovernanceSimulationError({
      code: 'SIMULATION_UNAUTHORIZED',
      method,
      message: 'SIMULATION_UNAUTHORIZED: the contract rejected this account’s authorization.',
      remediation:
        'This wallet is not authorized for this action. Confirm you are connected with the ' +
        'account that holds the required voting power or admin role.',
      diagnostics,
    });
  }

  if (RESOURCE_PATTERN.test(rawError)) {
    return new GovernanceSimulationError({
      code: 'SIMULATION_INSUFFICIENT_RESOURCES',
      method,
      message: 'SIMULATION_INSUFFICIENT_RESOURCES: the transaction exceeded its resource budget.',
      remediation:
        'The network could not fit this transaction in one submission. Retry in a moment; ' +
        'if it keeps failing the contract call is too large for current network limits.',
      diagnostics,
    });
  }

  const contractError = CONTRACT_ERROR_PATTERN.exec(rawError);
  if (contractError) {
    return new GovernanceSimulationError({
      code: 'SIMULATION_CONTRACT_ERROR',
      method,
      message: `SIMULATION_CONTRACT_ERROR: the contract rejected this call with error #${contractError[1]}.`,
      remediation:
        'The governance contract refused this action under its own rules — for example voting ' +
        'twice, or acting on a proposal whose voting window has closed. Reload and re-check ' +
        'the proposal state.',
      diagnostics,
    });
  }

  return new GovernanceSimulationError({
    code: 'SIMULATION_FAILED',
    method,
    message: 'SIMULATION_FAILED: the transaction could not be simulated.',
    remediation:
      'The network rejected this transaction before signing. Reload the proposal and try ' +
      'again; no signature was requested and nothing was submitted.',
    diagnostics,
  });
}

// ─── Preflight ────────────────────────────────────────────────────────────────

/**
 * Throws unless a governance contract is explicitly configured.
 *
 * `GOVERNANCE_CONTRACT_ID` falls back to the invoice `CONTRACT_ID` when
 * `NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID` is unset, and that contract has no
 * governance entry points. Checking the *configuration* rather than waiting
 * for the inevitable `ENTRYPOINT_MISSING` keeps an unconfigured deployment
 * from spending an RPC round-trip (and a wallet prompt) per click.
 */
export function assertGovernanceWritesConfigured(method?: GovernanceMutationMethod): void {
  if (GOVERNANCE_CONTRACT_CONFIGURED) return;
  throw new GovernanceUnavailableError({
    code: 'CONTRACT_NOT_CONFIGURED',
    method,
    message:
      'CONTRACT_NOT_CONFIGURED: no governance contract is configured, so governance ' +
      'transactions cannot be built.',
    remediation:
      'Set NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID to a deployed iln_governance contract to enable ' +
      'on-chain governance actions.',
  });
}

/** Chain-derived proposal fields needed to decide whether execution is possible. */
export interface ExecutableProposalSnapshot {
  id: number;
  status: string;
  /** Earliest execution time (ETA), in Unix seconds, when the chain reports one. */
  executableAfter?: number;
}

function proposalNotExecutable(message: string, remediation: string, diagnostics?: string) {
  return new GovernanceTxError({
    code: 'PROPOSAL_NOT_EXECUTABLE',
    phase: 'preflight',
    method: 'execute_proposal',
    message: `PROPOSAL_NOT_EXECUTABLE: ${message}`,
    remediation,
    diagnostics,
    // Nothing was signed. A retry is safe once fresh state allows it.
    resubmitSafe: true,
  });
}

/**
 * Rejects execution from a freshly read proposal before the wallet opens.
 *
 * Only `Passed` proposals at or past their ETA continue. Missing, mismatched,
 * vetoed, rejected, active, and already executed proposals fail closed.
 */
export function assertProposalExecutable(
  proposal: ExecutableProposalSnapshot | null | undefined,
  proposalId: number,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): void {
  const reload = 'Reload the proposal to see its current on-chain state.';
  if (!proposal || proposal.id !== proposalId) {
    throw proposalNotExecutable(`proposal ${proposalId} could not be confirmed on-chain.`, reload);
  }
  if (proposal.status !== 'Passed') {
    throw proposalNotExecutable(
      `proposal ${proposalId} is ${proposal.status}, so it cannot be executed.`,
      reload
    );
  }
  if (
    proposal.executableAfter !== undefined &&
    nowSeconds + GOVERNANCE_ETA_CLOCK_SKEW_SECONDS < proposal.executableAfter
  ) {
    throw proposalNotExecutable(
      `proposal ${proposalId} is still inside its timelock.`,
      'Wait until the timelock expires, then try again.'
    );
  }
}

/** Builds the typed failure for a proposal state read that could not complete. */
export function proposalStateUnavailableError(err: unknown): GovernanceTxError {
  return proposalNotExecutable(
    'the latest proposal state could not be read.',
    'Check your connection and try again. Nothing was signed or submitted.',
    err instanceof Error ? err.message : String(err)
  );
}

/** True when on-chain governance writes are possible in this deployment. */
export function governanceWritesEnabled(): boolean {
  return GOVERNANCE_CONTRACT_CONFIGURED;
}

// ─── Stage 1: build + simulate, before any wallet prompt (#1044) ─────────────

export interface GovernanceSimulationResult {
  /** The assembled, simulation-prepared transaction, ready to sign. */
  prepared: Transaction;
  /** Return value of the simulated call, when the entry point returns one. */
  returnValue?: xdr.ScVal;
  /** Minimum resource fee simulation determined for this transaction. */
  minResourceFee?: string;
}

/**
 * Builds and simulates a governance mutation **without** signing it.
 *
 * Separated from submission so a caller can surface an authorization or
 * resource problem while the user is still looking at the confirmation
 * dialog, rather than after they have approved a doomed transaction (#1044).
 */
export async function simulateGovernanceMutation(options: {
  method: GovernanceMutationMethod;
  args: xdr.ScVal[];
  signerAddress: string;
  rpcServer?: Pick<rpc.Server, 'getAccount' | 'simulateTransaction'>;
}): Promise<GovernanceSimulationResult> {
  const { method, args, signerAddress } = options;
  const client = options.rpcServer ?? server;

  assertGovernanceWritesConfigured(method);

  const expectedArity = GOVERNANCE_MUTATION_ARITY[method];
  if (args.length !== expectedArity) {
    throw new GovernanceTxError({
      code: 'SIMULATION_FAILED',
      phase: 'preflight',
      method,
      message: `${method} expects ${expectedArity} arguments but received ${args.length}.`,
      remediation:
        'This is an integration defect: the call site and the contract signature disagree. ' +
        'Report it rather than retrying.',
      resubmitSafe: false,
    });
  }

  // A real source account is required: the sequence number and resource fees
  // come from the network, not from a placeholder. An unfunded or unknown
  // account is reported as such instead of as a simulation failure.
  let sourceAccount: Account;
  try {
    sourceAccount = (await client.getAccount(signerAddress)) as Account;
  } catch (err) {
    throw new GovernanceUnavailableError({
      code: 'SOURCE_ACCOUNT_MISSING',
      method,
      message: `SOURCE_ACCOUNT_MISSING: account ${signerAddress} could not be loaded.`,
      remediation:
        'This wallet account does not exist on the current network, or the network is ' +
        'unreachable. Fund the account and confirm your wallet is on the right network.',
      diagnostics: err instanceof Error ? err.message : String(err),
    });
  }

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: GOVERNANCE_CONTRACT_ID,
        function: method,
        args,
      })
    )
    .setTimeout(GOVERNANCE_TX_VALIDITY_SECONDS)
    .build();

  let simulation: rpc.Api.SimulateTransactionResponse;
  try {
    simulation = await client.simulateTransaction(tx);
  } catch (err) {
    // A transport failure is not a contract verdict; keep it distinct from a
    // contract-rejected simulation so the remediation stays accurate.
    throw new GovernanceSimulationError({
      code: 'SIMULATION_FAILED',
      method,
      message: 'SIMULATION_FAILED: the network could not be reached to simulate this action.',
      remediation:
        'The Soroban RPC endpoint is unreachable. Check your connection and try again; ' +
        'nothing was signed or submitted.',
      diagnostics: err instanceof Error ? err.message : String(err),
    });
  }

  if (rpc.Api.isSimulationError(simulation)) {
    throw classifyGovernanceSimulationError(String(simulation.error), method);
  }

  // Archived contract state must be restored in a separate transaction first.
  // Signing this one would waste a fee on a transaction that cannot apply.
  if (rpc.Api.isSimulationRestore(simulation)) {
    throw new GovernanceSimulationError({
      code: 'SIMULATION_ARCHIVED_STATE',
      method,
      message:
        'SIMULATION_ARCHIVED_STATE: this proposal’s contract state is archived and must be ' +
        'restored before it can be modified.',
      remediation:
        'The ledger entries for this proposal have expired from the active state. Restore them ' +
        'before voting or executing again.',
      diagnostics: JSON.stringify(simulation.restorePreamble),
    });
  }

  // `assembleTransaction` folds the simulated resource footprint and fee into
  // the transaction. Signing the *unassembled* transaction would submit one
  // without a footprint, which the network always rejects.
  const prepared = rpc.assembleTransaction(tx, simulation).build();

  return {
    prepared,
    returnValue: simulation.result?.retval,
    minResourceFee: simulation.minResourceFee,
  };
}

// ─── Stage 2: sign, submit, bounded confirmation (#1045) ─────────────────────

/** Stages a caller can reflect in the UI as the submission progresses. */
export type GovernanceSubmissionStage = 'signed' | 'submitted' | 'confirming';

export interface GovernanceConfirmation {
  txHash: string;
  /** Ledger the transaction settled in, when RPC reported one. */
  ledger?: number;
  /** Raw return value of the confirmed invocation, when present. */
  returnValue?: xdr.ScVal;
}

export interface GovernanceSubmitOptions {
  prepared: Transaction;
  signTx: (txXdr: string) => Promise<string>;
  method?: GovernanceMutationMethod;
  onStage?: (stage: GovernanceSubmissionStage) => void;
  /** Label recorded on the pending entry so a reload can reconcile it. */
  pendingLabel?: string;
  /** Stable key for the logical action; blocks replay across retries and reloads. */
  operationKey?: string;
  attempts?: number;
  intervalMs?: number;
  timeoutMs?: number;
  rpcServer?: Pick<rpc.Server, 'sendTransaction' | 'getTransaction'>;
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Signs, submits, and waits — within an explicit bound — for a prepared
 * governance transaction.
 *
 * Confirmation stops at whichever bound is reached first (attempts or the
 * wall-clock deadline) and resolves to exactly one of: confirmed, failed
 * ({@link GovernanceTxFailedError}), rejected
 * ({@link GovernanceSigningRejectedError}), or unknown
 * ({@link GovernanceTxTimeoutError}).
 */
export async function submitGovernanceMutation(
  options: GovernanceSubmitOptions
): Promise<GovernanceConfirmation> {
  const {
    prepared,
    signTx,
    method,
    onStage,
    pendingLabel,
    operationKey,
    attempts = GOVERNANCE_CONFIRMATION_ATTEMPTS,
    intervalMs = GOVERNANCE_CONFIRMATION_INTERVAL_MS,
    timeoutMs = GOVERNANCE_CONFIRMATION_TIMEOUT_MS,
    sleep = defaultSleep,
  } = options;
  const client = options.rpcServer ?? server;

  // The signature is the point of no return. Everything before it is
  // reversible; nothing after it can be un-submitted (#1144).
  let signedXdr: string;
  try {
    signedXdr = await signTx(prepared.toXDR());
  } catch (err) {
    if (isCancellationError(err)) {
      throw new GovernanceSigningRejectedError(method);
    }
    throw err;
  }
  onStage?.('signed');

  let signedTx: Transaction;
  try {
    signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as Transaction;
  } catch (err) {
    throw new GovernanceTxFailedError({
      code: 'SUBMISSION_REJECTED',
      phase: 'submission',
      method,
      message: 'SUBMISSION_REJECTED: the wallet returned a transaction that could not be decoded.',
      remediation:
        'Your wallet returned an unreadable signed transaction. Reconnect the wallet and try ' +
        'again; nothing was submitted.',
      diagnostics: err instanceof Error ? err.message : String(err),
    });
  }

  // Recorded before sending: a reload or dropped response during submission
  // must still leave a hash that can be reconciled (#1323).
  const pendingEntry = {
    label: pendingLabel ?? method ?? 'governance',
    ...(operationKey ? { operationKey } : {}),
  };
  const localHash = signedTx.hash().toString('hex');
  recordPendingTransaction({ hash: localHash, ...pendingEntry });

  let sent: rpc.Api.SendTransactionResponse;
  try {
    sent = await client.sendTransaction(signedTx);
  } catch {
    // The request may have reached the network, so the outcome is unknown.
    throw new GovernanceTxTimeoutError({ txHash: localHash, attempts: 0, elapsedMs: 0, method });
  }

  if (!sent?.hash || !sent.status) {
    // An unusable acknowledgement does not prove the transaction was refused.
    throw new GovernanceTxTimeoutError({ txHash: localHash, attempts: 0, elapsedMs: 0, method });
  }

  if (!ACCEPTED_SEND_STATUSES.has(sent.status)) {
    removePendingTransaction(localHash);
    throw new GovernanceTxFailedError({
      code: 'SUBMISSION_REJECTED',
      phase: 'submission',
      method,
      txHash: sent.hash,
      message: `SUBMISSION_REJECTED: the network refused the submission with status ${sent.status}.`,
      remediation:
        'The network rejected this transaction without applying it. Reload the proposal and ' +
        'try again.',
      diagnostics: sent.errorResult ? sent.errorResult.toXDR('base64') : undefined,
    });
  }

  onStage?.('submitted');
  if (sent.hash !== localHash) {
    removePendingTransaction(localHash);
    recordPendingTransaction({ hash: sent.hash, ...pendingEntry });
  }
  onStage?.('confirming');

  const startedAt = Date.now();
  let attempt = 0;

  while (attempt < attempts) {
    // A failed status read says nothing about the transaction, so it counts
    // as one more unsettled poll and remains subject to both bounds.
    let settled: rpc.Api.GetTransactionResponse | null;
    try {
      settled = await client.getTransaction(sent.hash);
    } catch {
      settled = null;
    }

    if (settled?.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      removePendingTransaction(sent.hash);
      return {
        txHash: sent.hash,
        ledger: 'ledger' in settled ? settled.ledger : undefined,
        returnValue: 'returnValue' in settled ? settled.returnValue : undefined,
      };
    }

    if (settled?.status === rpc.Api.GetTransactionStatus.FAILED) {
      // A settled failure is final: drop the pending entry so it is not
      // re-polled, and report it as a failure rather than a timeout.
      removePendingTransaction(sent.hash);
      throw new GovernanceTxFailedError({
        method,
        txHash: sent.hash,
        message: `TX_FAILED: transaction ${sent.hash} was rejected on-chain.`,
        remediation:
          'The network applied no changes. Reload the proposal to see its current state before ' +
          'trying again.',
        diagnostics:
          'resultXdr' in settled && settled.resultXdr
            ? settled.resultXdr.toXDR('base64')
            : undefined,
      });
    }

    attempt += 1;

    // Both bounds are checked before sleeping again so the loop cannot
    // overshoot the deadline by a whole interval.
    if (attempt >= attempts || Date.now() - startedAt + intervalMs > timeoutMs) {
      break;
    }

    await sleep(intervalMs);
  }

  // Bound reached while still NOT_FOUND. The transaction is live until its
  // time bound expires, so the pending entry is intentionally left in place
  // for reconciliation — this is an unknown outcome, not a failure (#1045).
  throw new GovernanceTxTimeoutError({
    txHash: sent.hash,
    attempts: attempt,
    elapsedMs: Date.now() - startedAt,
    method,
  });
}

// ─── Full pipeline ────────────────────────────────────────────────────────────

export interface GovernanceMutationOptions {
  method: GovernanceMutationMethod;
  args: xdr.ScVal[];
  signerAddress: string;
  signTx: (txXdr: string) => Promise<string>;
  onStage?: (stage: GovernanceSubmissionStage) => void;
  pendingLabel?: string;
  /** Stable key for the logical action; see {@link submitGovernanceMutation}. */
  operationKey?: string;
  attempts?: number;
  intervalMs?: number;
  timeoutMs?: number;
  rpcServer?: Pick<
    rpc.Server,
    'getAccount' | 'simulateTransaction' | 'sendTransaction' | 'getTransaction'
  >;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Settles an earlier submission of the same operation from network truth.
 *
 * Returns its confirmation when it landed, `null` when a new attempt is safe,
 * and throws `DUPLICATE_PENDING` while the outcome is still unknown.
 */
async function resolvePendingOperation(
  operationKey: string,
  client: Pick<rpc.Server, 'getTransaction'>,
  method: GovernanceMutationMethod
): Promise<GovernanceConfirmation | null> {
  const pending = findPendingOperation(operationKey);
  if (!pending) return null;

  let settled: rpc.Api.GetTransactionResponse | null;
  try {
    settled = await client.getTransaction(pending.hash);
  } catch {
    settled = null;
  }

  if (settled?.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    removePendingTransaction(pending.hash);
    return {
      txHash: pending.hash,
      ledger: 'ledger' in settled ? settled.ledger : undefined,
      returnValue: 'returnValue' in settled ? settled.returnValue : undefined,
    };
  }
  if (settled?.status === rpc.Api.GetTransactionStatus.FAILED) {
    removePendingTransaction(pending.hash);
    return null;
  }
  if (settled && Date.now() - pending.createdAt > GOVERNANCE_PENDING_LOCK_MS) {
    // NOT_FOUND past the time bound: it can no longer apply. If it applied and
    // was pruned from RPC history, simulation still sees the contract state.
    removePendingTransaction(pending.hash);
    return null;
  }

  throw new GovernanceTxError({
    code: 'DUPLICATE_PENDING',
    phase: 'preflight',
    method,
    txHash: pending.hash,
    message: `DUPLICATE_PENDING: transaction ${pending.hash} for this action is still unsettled.`,
    remediation:
      'Your earlier transaction may still confirm. Wait for it to settle before trying again.',
    resubmitSafe: false,
  });
}

/**
 * Runs a governance mutation end to end: simulate (#1044) → sign → submit →
 * bounded confirmation (#1045).
 *
 * Resolves only on a network-confirmed transaction. Every other outcome
 * throws a {@link GovernanceTxError} whose `code` says which it was.
 */
export async function executeGovernanceMutation(
  options: GovernanceMutationOptions
): Promise<GovernanceConfirmation> {
  if (options.operationKey) {
    const replay = await resolvePendingOperation(
      options.operationKey,
      options.rpcServer ?? server,
      options.method
    );
    if (replay) return replay;
  }

  const { prepared } = await simulateGovernanceMutation({
    method: options.method,
    args: options.args,
    signerAddress: options.signerAddress,
    rpcServer: options.rpcServer,
  });

  return submitGovernanceMutation({
    prepared,
    signTx: options.signTx,
    method: options.method,
    onStage: options.onStage,
    pendingLabel: options.pendingLabel,
    operationKey: options.operationKey,
    attempts: options.attempts,
    intervalMs: options.intervalMs,
    timeoutMs: options.timeoutMs,
    rpcServer: options.rpcServer,
    sleep: options.sleep,
  });
}

// ─── Post-timeout reconciliation (#1045) ─────────────────────────────────────

export type GovernanceTxOutcome = 'confirmed' | 'failed' | 'pending' | 'unknown';

/**
 * Resolves the current outcome of a submitted governance transaction.
 *
 * This is the supported follow-up to {@link GovernanceTxTimeoutError}: a
 * timeout leaves a real hash whose verdict the network can still supply, so
 * the UI can settle it without re-signing. `pending` means the network has
 * not seen it settle yet; `unknown` means the lookup itself failed.
 */
export async function fetchGovernanceTxOutcome(
  txHash: string,
  rpcServer?: Pick<rpc.Server, 'getTransaction'>
): Promise<GovernanceTxOutcome> {
  const client = rpcServer ?? server;
  try {
    const settled = await client.getTransaction(txHash);
    if (settled.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      removePendingTransaction(txHash);
      return 'confirmed';
    }
    if (settled.status === rpc.Api.GetTransactionStatus.FAILED) {
      removePendingTransaction(txHash);
      return 'failed';
    }
    return 'pending';
  } catch {
    return 'unknown';
  }
}
