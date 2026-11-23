import { rpc, scValToNative, type xdr } from '@stellar/stellar-sdk';

export type GovernanceReadState =
  | { status: 'ready'; ledgerSequence: number; observedAt: string; stale: boolean }
  | { status: 'error'; message: string; observedAt: string };

export function governanceReadMetadata(
  sequence: number,
  observedAt = new Date().toISOString(),
  maxAgeMs = 30_000
): GovernanceReadState {
  if (!Number.isInteger(sequence) || sequence < 0) {
    return { status: 'error', message: 'Governance ledger sequence is unavailable.', observedAt };
  }
  return {
    status: 'ready',
    ledgerSequence: sequence,
    observedAt,
    stale: Date.now() - Date.parse(observedAt) > maxAgeMs,
  };
}

// ─── Created proposal identifiers (#1321) ─────────────────────────────────────
//
// The only source of a proposal id is the return value of a confirmed
// `create_proposal` transaction. Contract events are not consulted, so event or
// indexer delay cannot change or lose the id. Local storage holds public
// recovery metadata only and is never treated as proof of settlement:
//
// | Network result                 | Stored state | Retry behavior                |
// | ------------------------------ | ------------ | ----------------------------- |
// | Submitted, no verdict          | pending      | Blocked until it settles      |
// | SUCCESS with a valid id        | confirmed    | Returns the same id           |
// | SUCCESS without a valid id     | unresolved   | Blocked during replay window  |
// | FAILED                         | removed      | New attempt allowed           |
// | NOT_FOUND past the time bound  | removed      | New attempt allowed           |
// | RPC unreachable                | unchanged    | Blocked                       |

export const CREATED_PROPOSALS_STORAGE_KEY = 'iln_governance_created_proposals_v1';
/** Entries older than this are discarded on read. */
export const TRACKED_PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;
/** A transaction with a 60s time bound cannot apply after this, including clock margin. */
export const TRACKED_PROPOSAL_LOCK_MS = 120_000;
/** How long an identical request may replay a settled creation. */
export const CREATED_PROPOSAL_REPLAY_WINDOW_MS = 10 * 60 * 1000;
const MAX_TRACKED_PROPOSALS = 25;

export type TrackedProposalStatus = 'pending' | 'confirmed' | 'unresolved';

export interface TrackedProposal {
  /** Network passphrase plus governance contract, so ids never cross deployments. */
  scope: string;
  operationKey: string;
  txHash: string;
  status: TrackedProposalStatus;
  proposalId?: number;
  createdAt: number;
}

export type TrackedProposalRecovery =
  | { kind: 'none' }
  | { kind: 'confirmed'; proposalId: number; txHash: string }
  | { kind: 'blocked'; reason: 'pending' | 'unresolved'; txHash: string };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type TransactionLookup = (hash: string) => Promise<{ status: string; returnValue?: xdr.ScVal }>;

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isValidProposalId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isTrackedProposal(value: unknown): value is TrackedProposal {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<TrackedProposal>;
  return (
    typeof entry.scope === 'string' &&
    typeof entry.operationKey === 'string' &&
    typeof entry.txHash === 'string' &&
    /^[a-f0-9]{64}$/i.test(entry.txHash) &&
    (entry.status === 'pending' ||
      entry.status === 'unresolved' ||
      (entry.status === 'confirmed' && isValidProposalId(entry.proposalId))) &&
    typeof entry.createdAt === 'number' &&
    Number.isFinite(entry.createdAt)
  );
}

function readEntries(storage?: StorageLike, now = Date.now()): TrackedProposal[] {
  const store = resolveStorage(storage);
  if (!store) return [];
  try {
    const parsed: unknown = JSON.parse(store.getItem(CREATED_PROPOSALS_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isTrackedProposal)
      .filter((entry) => now - entry.createdAt <= TRACKED_PROPOSAL_TTL_MS);
  } catch {
    return [];
  }
}

function writeEntries(entries: TrackedProposal[], storage?: StorageLike): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(
      CREATED_PROPOSALS_STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_TRACKED_PROPOSALS))
    );
  } catch {
    // Storage is a recovery aid. Losing it must not break the transaction flow.
  }
}

export function proposalTrackingScope(networkPassphrase: string, contractId: string): string {
  return `${networkPassphrase}:${contractId}`;
}

/** Decodes the id returned by `create_proposal`; never invents a fallback. */
export function decodeCreatedProposalId(value?: xdr.ScVal): number | null {
  if (!value) return null;
  try {
    const native: unknown = scValToNative(value);
    const id =
      typeof native === 'bigint' ? native : typeof native === 'number' ? BigInt(native) : null;
    if (id === null || id <= 0n || id > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(id);
  } catch {
    return null;
  }
}

export function getTrackedProposals(scope: string, storage?: StorageLike): TrackedProposal[] {
  return readEntries(storage).filter((entry) => entry.scope === scope);
}

export function trackProposalSubmission(
  entry: Pick<TrackedProposal, 'scope' | 'operationKey' | 'txHash'> & { createdAt?: number },
  storage?: StorageLike
): void {
  const others = readEntries(storage).filter(
    (item) =>
      item.txHash !== entry.txHash &&
      !(item.scope === entry.scope && item.operationKey === entry.operationKey)
  );
  writeEntries(
    [
      {
        scope: entry.scope,
        operationKey: entry.operationKey,
        txHash: entry.txHash,
        status: 'pending',
        createdAt: entry.createdAt ?? Date.now(),
      },
      ...others,
    ],
    storage
  );
}

export function updateTrackedProposal(
  txHash: string,
  update: Partial<Pick<TrackedProposal, 'txHash' | 'status' | 'proposalId'>>,
  storage?: StorageLike
): void {
  writeEntries(
    readEntries(storage).map((entry) =>
      entry.txHash === txHash ? { ...entry, ...update } : entry
    ),
    storage
  );
}

export function forgetTrackedProposal(txHash: string, storage?: StorageLike): void {
  writeEntries(
    readEntries(storage).filter((entry) => entry.txHash !== txHash),
    storage
  );
}

/**
 * Refreshes one entry from network truth. Returns the current entry, or `null`
 * when the transaction failed or expired and the entry was removed.
 */
export async function reconcileTrackedProposal(
  entry: TrackedProposal,
  getTransaction: TransactionLookup,
  storage?: StorageLike,
  now = Date.now()
): Promise<TrackedProposal | null> {
  if (entry.status !== 'pending') return entry;

  let settled: Awaited<ReturnType<TransactionLookup>>;
  try {
    settled = await getTransaction(entry.txHash);
  } catch {
    return entry;
  }

  if (settled.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    const proposalId = decodeCreatedProposalId(settled.returnValue);
    const updated: TrackedProposal =
      proposalId === null
        ? { ...entry, status: 'unresolved' }
        : { ...entry, status: 'confirmed', proposalId };
    updateTrackedProposal(
      entry.txHash,
      { status: updated.status, proposalId: updated.proposalId },
      storage
    );
    return updated;
  }
  if (settled.status === rpc.Api.GetTransactionStatus.FAILED) {
    forgetTrackedProposal(entry.txHash, storage);
    return null;
  }
  if (now - entry.createdAt > TRACKED_PROPOSAL_LOCK_MS) {
    forgetTrackedProposal(entry.txHash, storage);
    return null;
  }
  return entry;
}

/** Decides whether a retry must reuse, wait for, or may replace an earlier creation. */
export async function recoverTrackedProposal(
  scope: string,
  operationKey: string,
  getTransaction: TransactionLookup,
  storage?: StorageLike,
  now = Date.now()
): Promise<TrackedProposalRecovery> {
  const entry = readEntries(storage, now).find(
    (item) => item.scope === scope && item.operationKey === operationKey
  );
  if (!entry) return { kind: 'none' };

  if (entry.status !== 'pending' && now - entry.createdAt > CREATED_PROPOSAL_REPLAY_WINDOW_MS) {
    // An identical proposal outside the replay window is a new governance action.
    forgetTrackedProposal(entry.txHash, storage);
    return { kind: 'none' };
  }

  const current = await reconcileTrackedProposal(entry, getTransaction, storage, now);
  if (!current) return { kind: 'none' };
  if (current.status === 'confirmed' && current.proposalId !== undefined) {
    forgetTrackedProposal(current.txHash, storage);
    return { kind: 'confirmed', proposalId: current.proposalId, txHash: current.txHash };
  }
  return {
    kind: 'blocked',
    reason: current.status === 'unresolved' ? 'unresolved' : 'pending',
    txHash: current.txHash,
  };
}
