/**
 * Replay, interruption, and stale-state behavior of governance writes (#1323).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Account, Address, nativeToScVal, rpc, SorobanDataBuilder } from '@stellar/stellar-sdk';

import {
  assertProposalExecutable,
  executeGovernanceMutation,
  GOVERNANCE_ETA_CLOCK_SKEW_SECONDS,
  GOVERNANCE_PENDING_LOCK_MS,
  GovernanceTxError,
} from '../governance-tx';
import {
  getPendingTransactions,
  PENDING_TRANSACTIONS_STORAGE_KEY,
  recordPendingTransaction,
} from '../pending-transactions';

vi.mock('@/constants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/constants')>()),
  GOVERNANCE_CONTRACT_CONFIGURED: true,
  GOVERNANCE_CONTRACT_ID: 'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC',
}));

const SIGNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const EARLIER_HASH = 'b'.repeat(64);
const OPERATION_KEY = 'execute_proposal:7';

const { SUCCESS, FAILED, NOT_FOUND } = rpc.Api.GetTransactionStatus;

function makeServer(getTransaction = vi.fn(async () => ({ status: SUCCESS, ledger: 9 }))) {
  return {
    getAccount: vi.fn(async () => new Account(SIGNER, '42')),
    simulateTransaction: vi.fn(async () => ({
      _parsed: true,
      id: '1',
      latestLedger: 100,
      events: [],
      transactionData: new SorobanDataBuilder(),
      minResourceFee: '1000',
      result: { auth: [], retval: nativeToScVal(7, { type: 'u64' }) },
    })),
    sendTransaction: vi.fn(async () => ({ hash: 'a'.repeat(64), status: 'PENDING' })),
    getTransaction,
    // The pipeline uses only these four `rpc.Server` methods.
  } as any;
}

const run = (rpcServer: any, signTx = vi.fn(async (xdr: string) => xdr)) =>
  executeGovernanceMutation({
    method: 'execute_proposal',
    args: [Address.fromString(SIGNER).toScVal(), nativeToScVal(7, { type: 'u64' })],
    signerAddress: SIGNER,
    signTx,
    operationKey: OPERATION_KEY,
    attempts: 2,
    intervalMs: 0,
    sleep: async () => {},
    rpcServer,
  });

const recordEarlier = (createdAt = Date.now()) =>
  recordPendingTransaction({ hash: EARLIER_HASH, operationKey: OPERATION_KEY, createdAt });

beforeEach(() => localStorage.removeItem(PENDING_TRANSACTIONS_STORAGE_KEY));
afterEach(() => vi.restoreAllMocks());

describe('governance replay protection (#1323)', () => {
  it('returns a settled earlier transaction without signing again', async () => {
    recordEarlier();
    const server = makeServer();
    const signTx = vi.fn(async (xdr: string) => xdr);

    await expect(run(server, signTx)).resolves.toMatchObject({ txHash: EARLIER_HASH });
    expect(signTx).not.toHaveBeenCalled();
    expect(server.sendTransaction).not.toHaveBeenCalled();
    expect(getPendingTransactions()).toEqual([]);
  });

  it('blocks a retry while the earlier transaction is unsettled', async () => {
    recordEarlier();
    const server = makeServer(vi.fn(async () => ({ status: NOT_FOUND })) as any);
    const signTx = vi.fn(async (xdr: string) => xdr);

    await expect(run(server, signTx)).rejects.toMatchObject({
      code: 'DUPLICATE_PENDING',
      txHash: EARLIER_HASH,
      resubmitSafe: false,
    });
    expect(signTx).not.toHaveBeenCalled();
  });

  it('blocks a retry when RPC cannot report the earlier outcome', async () => {
    recordEarlier(Date.now() - GOVERNANCE_PENDING_LOCK_MS - 1);
    const server = makeServer(vi.fn().mockRejectedValue(new Error('offline')));

    await expect(run(server)).rejects.toMatchObject({ code: 'DUPLICATE_PENDING' });
    expect(getPendingTransactions()).toHaveLength(1);
  });

  it('allows a new attempt after the earlier transaction failed', async () => {
    recordEarlier();
    const getTransaction = vi
      .fn()
      .mockResolvedValueOnce({ status: FAILED })
      .mockResolvedValue({ status: SUCCESS, ledger: 10 });
    const server = makeServer(getTransaction);

    await expect(run(server)).resolves.toMatchObject({ txHash: 'a'.repeat(64) });
    expect(server.sendTransaction).toHaveBeenCalledTimes(1);
  });

  it('releases the lock once the earlier transaction is past its time bound', async () => {
    recordEarlier(Date.now() - GOVERNANCE_PENDING_LOCK_MS - 1);
    const getTransaction = vi
      .fn()
      .mockResolvedValueOnce({ status: NOT_FOUND })
      .mockResolvedValue({ status: SUCCESS, ledger: 10 });
    const server = makeServer(getTransaction);

    await expect(run(server)).resolves.toMatchObject({ txHash: 'a'.repeat(64) });
  });

  it('keeps a reconcilable hash when sendTransaction is interrupted', async () => {
    const server = makeServer();
    server.sendTransaction.mockRejectedValue(new Error('connection reset'));

    const error = await run(server).catch((err) => err);

    expect(error).toMatchObject({ code: 'TX_TIMEOUT', resubmitSafe: false });
    expect(getPendingTransactions()).toEqual([
      expect.objectContaining({ hash: error.txHash, operationKey: OPERATION_KEY }),
    ]);
  });

  it('removes the pending entry when the network refuses the submission', async () => {
    const server = makeServer();
    server.sendTransaction.mockResolvedValue({ hash: 'c'.repeat(64), status: 'ERROR' });

    await expect(run(server)).rejects.toMatchObject({ code: 'SUBMISSION_REJECTED' });
    expect(getPendingTransactions()).toEqual([]);
  });

  it('treats a failed status poll as unknown, never as a failure', async () => {
    const server = makeServer(vi.fn().mockRejectedValue(new Error('offline')));

    await expect(run(server)).rejects.toMatchObject({ code: 'TX_TIMEOUT', resubmitSafe: false });
    expect(getPendingTransactions()).toHaveLength(1);
  });
});

describe('assertProposalExecutable (#1323)', () => {
  const NOW = 1_800_000_000;

  it('allows a passed proposal at its ETA', () => {
    expect(() =>
      assertProposalExecutable({ id: 7, status: 'Passed', executableAfter: NOW }, 7, NOW)
    ).not.toThrow();
  });

  it('rejects a proposal before its ETA', () => {
    const executableAfter = NOW + GOVERNANCE_ETA_CLOCK_SKEW_SECONDS + 1;
    expect(() =>
      assertProposalExecutable({ id: 7, status: 'Passed', executableAfter }, 7, NOW)
    ).toThrow(/timelock/);
  });

  it('leaves an ETA inside the clock-skew window to the contract', () => {
    const executableAfter = NOW + GOVERNANCE_ETA_CLOCK_SKEW_SECONDS;
    expect(() =>
      assertProposalExecutable({ id: 7, status: 'Passed', executableAfter }, 7, NOW)
    ).not.toThrow();
  });

  it.each(['Vetoed', 'Executed', 'Rejected', 'Active'])('rejects a %s proposal', (status) => {
    expect(() => assertProposalExecutable({ id: 7, status }, 7, NOW)).toThrow(GovernanceTxError);
  });

  it('fails closed on a missing or mismatched proposal', () => {
    expect(() => assertProposalExecutable(null, 7, NOW)).toThrow(/could not be confirmed/);
    expect(() => assertProposalExecutable({ id: 8, status: 'Passed' }, 7, NOW)).toThrow(
      /could not be confirmed/
    );
  });
});
