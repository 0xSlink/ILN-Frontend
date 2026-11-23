import { nativeToScVal, rpc } from '@stellar/stellar-sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  CREATED_PROPOSAL_REPLAY_WINDOW_MS,
  CREATED_PROPOSALS_STORAGE_KEY,
  decodeCreatedProposalId,
  getTrackedProposals,
  governanceReadMetadata,
  proposalTrackingScope,
  recoverTrackedProposal,
  TRACKED_PROPOSAL_LOCK_MS,
  TRACKED_PROPOSAL_TTL_MS,
  trackProposalSubmission,
  updateTrackedProposal,
} from './metadata';

describe('governance read metadata', () => {
  it('exposes ledger freshness and explicit read failures', () => {
    expect(governanceReadMetadata(42, new Date().toISOString()).status).toBe('ready');
    expect(governanceReadMetadata(-1).status).toBe('error');
  });
});

const { SUCCESS, FAILED, NOT_FOUND } = rpc.Api.GetTransactionStatus;
const SCOPE = proposalTrackingScope('Test Network', 'CCONTRACT');
const KEY = 'proposer:title:FeeRate:300';
const HASH = 'a'.repeat(64);
const NOW = 1_800_000_000_000;

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

function trackedStorage(createdAt = NOW) {
  const storage = memoryStorage();
  trackProposalSubmission({ scope: SCOPE, operationKey: KEY, txHash: HASH, createdAt }, storage);
  return storage;
}

const recover = (storage: ReturnType<typeof memoryStorage>, lookup: any, now = NOW) =>
  recoverTrackedProposal(SCOPE, KEY, lookup, storage, now);

describe('created proposal id persistence (#1321)', () => {
  it('decodes only valid ids from the transaction return value', () => {
    expect(decodeCreatedProposalId(nativeToScVal(42, { type: 'u64' }))).toBe(42);
    expect(decodeCreatedProposalId(nativeToScVal(0, { type: 'u64' }))).toBeNull();
    expect(decodeCreatedProposalId(nativeToScVal('42'))).toBeNull();
    expect(decodeCreatedProposalId(undefined)).toBeNull();
    expect(
      decodeCreatedProposalId(nativeToScVal(BigInt(Number.MAX_SAFE_INTEGER) + 1n, { type: 'u64' }))
    ).toBeNull();
  });

  it('recovers the chain id after a reload without any contract event', async () => {
    const storage = trackedStorage();
    const lookup = vi.fn(async () => ({
      status: SUCCESS,
      returnValue: nativeToScVal(42, { type: 'u64' }),
    }));

    await expect(recover(storage, lookup)).resolves.toEqual({
      kind: 'confirmed',
      proposalId: 42,
      txHash: HASH,
    });
    expect(lookup).toHaveBeenCalledWith(HASH);
    expect(getTrackedProposals(SCOPE, storage)).toEqual([]);
  });

  it('blocks a retry while the transaction is unsettled', async () => {
    const storage = trackedStorage();
    await expect(recover(storage, async () => ({ status: NOT_FOUND }))).resolves.toEqual({
      kind: 'blocked',
      reason: 'pending',
      txHash: HASH,
    });
  });

  it('blocks a retry and keeps the entry when RPC is unreachable', async () => {
    const storage = trackedStorage();
    const lookup = vi.fn().mockRejectedValue(new Error('offline'));

    await expect(recover(storage, lookup, NOW + TRACKED_PROPOSAL_LOCK_MS + 1)).resolves.toEqual({
      kind: 'blocked',
      reason: 'pending',
      txHash: HASH,
    });
    expect(getTrackedProposals(SCOPE, storage)).toHaveLength(1);
  });

  it('allows a new attempt after an on-chain failure', async () => {
    const storage = trackedStorage();
    await expect(recover(storage, async () => ({ status: FAILED }))).resolves.toEqual({
      kind: 'none',
    });
  });

  it('allows a new attempt after the transaction time bound', async () => {
    const storage = trackedStorage();
    await expect(
      recover(storage, async () => ({ status: NOT_FOUND }), NOW + TRACKED_PROPOSAL_LOCK_MS + 1)
    ).resolves.toEqual({ kind: 'none' });
  });

  it('never resubmits a confirmed transaction with an unreadable id', async () => {
    const storage = trackedStorage();
    await expect(recover(storage, async () => ({ status: SUCCESS }))).resolves.toEqual({
      kind: 'blocked',
      reason: 'unresolved',
      txHash: HASH,
    });
  });

  it('treats an identical proposal after the replay window as new', async () => {
    const storage = trackedStorage();
    updateTrackedProposal(HASH, { status: 'confirmed', proposalId: 42 }, storage);
    const lookup = vi.fn();
    const later = NOW + CREATED_PROPOSAL_REPLAY_WINDOW_MS + 1;

    // Keep the fixture inside its TTL while moving past the replay window.
    expect(later - NOW).toBeLessThan(TRACKED_PROPOSAL_TTL_MS);
    await expect(recover(storage, lookup, later)).resolves.toEqual({ kind: 'none' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('does not reuse an id from another network or contract', async () => {
    const storage = trackedStorage();
    const otherScope = proposalTrackingScope('Public Network', 'CCONTRACT');

    await expect(recoverTrackedProposal(otherScope, KEY, vi.fn(), storage, NOW)).resolves.toEqual({
      kind: 'none',
    });
  });

  it('ignores corrupt storage', async () => {
    const storage = memoryStorage();
    storage.setItem(CREATED_PROPOSALS_STORAGE_KEY, '{not json');
    await expect(recover(storage, vi.fn())).resolves.toEqual({ kind: 'none' });

    storage.setItem(
      CREATED_PROPOSALS_STORAGE_KEY,
      JSON.stringify([
        { scope: SCOPE, operationKey: KEY, txHash: HASH, status: 'confirmed', createdAt: NOW },
      ])
    );
    await expect(recover(storage, vi.fn())).resolves.toEqual({ kind: 'none' });
  });
});
