import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Account, nativeToScVal, rpc } from '@stellar/stellar-sdk';

vi.mock('@/constants', () => ({
  GOVERNANCE_CONTRACT_ID: 'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC',
  ILN_TOKEN_CONTRACT_ID: 'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC',
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  RPC_URL: 'https://soroban-testnet.stellar.org',
  STELLAR_NETWORK: 'testnet',
}));

import { createProposal, fetchProposals, MOCK_PROPOSALS } from '../governance';

const SIGNER = 'GBZXN7PIRZGNMHGA728RGRTDGBLTYNGHXMH2Y7QGE2FMQ3GVFCYX2O64';
const TX_HASH = 'a'.repeat(64);

describe('governance Soroban contract boundary', () => {
  let getAccount: ReturnType<typeof vi.spyOn>;
  let prepareTransaction: ReturnType<typeof vi.spyOn>;
  let sendTransaction: ReturnType<typeof vi.spyOn>;
  let pollTransaction: ReturnType<typeof vi.spyOn>;
  let simulateTransaction: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getAccount = vi
      .spyOn(rpc.Server.prototype, 'getAccount')
      .mockResolvedValue(new Account(SIGNER, '1'));
    prepareTransaction = vi
      .spyOn(rpc.Server.prototype, 'prepareTransaction')
      .mockImplementation(async (transaction) => transaction);
    sendTransaction = vi
      .spyOn(rpc.Server.prototype, 'sendTransaction')
      .mockResolvedValue({ status: 'PENDING', hash: TX_HASH } as never);
    pollTransaction = vi.spyOn(rpc.Server.prototype, 'pollTransaction').mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.SUCCESS,
      returnValue: nativeToScVal(77n, { type: 'u64' }),
    } as never);
    simulateTransaction = vi.spyOn(rpc.Server.prototype, 'simulateTransaction');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the confirmed ledger proposal ID and transaction hash without mutating fixtures', async () => {
    const originalCount = MOCK_PROPOSALS.length;
    const signTx = vi.fn(async (xdr: string) => xdr);
    const result = await createProposal(
      {
        formType: 'FeeRate',
        title: 'Update the fee',
        description: 'Set the fee to 30 basis points.',
        newValueBps: 30,
      },
      SIGNER,
      signTx
    );

    expect(getAccount).toHaveBeenCalledWith(SIGNER);
    expect(prepareTransaction).toHaveBeenCalledOnce();
    expect(signTx).toHaveBeenCalledOnce();
    expect(sendTransaction).toHaveBeenCalledOnce();
    expect(pollTransaction).toHaveBeenCalledWith(TX_HASH, { attempts: 20 });
    expect(result).toEqual({ txHash: TX_HASH, proposalId: 77 });
    expect(MOCK_PROPOSALS).toHaveLength(originalCount);
  });

  it('decodes proposal status from the contract response', async () => {
    simulateTransaction.mockResolvedValueOnce({
      result: {
        retval: nativeToScVal([
          {
            id: 77n,
            action_type: { UpdateFeeRate: [30] },
            description_hash: new Uint8Array(32),
            status: { Rejected: [] },
            proposer: SIGNER,
            created_at: 1_700_000_000n,
            voting_end: 1_700_604_800n,
            votes_for: 100n,
            votes_against: 150n,
            eta_ledger: 0,
          },
        ]),
      },
    } as never);

    const proposals = await fetchProposals();
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      id: 77,
      status: 'Rejected',
      type: 'ParameterUpdate',
      votesFor: 100,
      votesAgainst: 150,
    });
  });

  it('surfaces an on-chain submission failure and does not report a success hash', async () => {
    sendTransaction.mockResolvedValueOnce({ status: 'ERROR', hash: TX_HASH } as never);
    const signTx = vi.fn(async (xdr: string) => xdr);

    await expect(
      createProposal(
        {
          formType: 'FeeRate',
          title: 'Update the fee',
          description: 'Set the fee to 30 basis points.',
          newValueBps: 30,
        },
        SIGNER,
        signTx
      )
    ).rejects.toThrow(/submission failed with status ERROR/i);
    expect(pollTransaction).not.toHaveBeenCalled();
  });
});
