import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockServer, mockTx, mockAssembledTx } = vi.hoisted(() => {
  const mockTx: any = {
    toEnvelope: vi.fn(() => ({ toXDR: () => 'xdr' })),
    toXDR: vi.fn(() => 'txXDR'),
  };
  const mockAssembledTx: any = { build: vi.fn(() => mockTx) };
  const mockServer: any = {
    getHealth: vi.fn(() => Promise.resolve({ status: 'healthy' })),
    simulateTransaction: vi.fn(() => Promise.resolve({ result: { retval: {} } })),
    getAccount: vi.fn(() =>
      Promise.resolve({
        accountId: () => 'GAAA',
        incrementSequenceNumber: vi.fn(),
        sequenceNumber: () => '100',
      })
    ),
    sendTransaction: vi.fn(() => Promise.resolve({ status: 'PENDING', hash: 'txhash123' })),
    getTransaction: vi.fn(() => Promise.resolve({ status: 'SUCCESS' })),
    getLatestLedger: vi.fn(() => Promise.resolve({ sequence: 100000 })),
    prepareTransaction: vi.fn(() => Promise.resolve(mockTx)),
    pollTransaction: vi.fn(() => Promise.resolve({ status: 'SUCCESS' })),
  };
  return { mockServer, mockTx, mockAssembledTx };
});

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    rpc: {
      Server: function () {
        return mockServer;
      },
      Api: {
        isSimulationSuccess: vi.fn((r: any) => !!r?.result),
        GetTransactionStatus: { SUCCESS: 'SUCCESS' },
      },
      assembleTransaction: vi.fn(() => mockAssembledTx),
    },
    scValToNative: vi.fn((val: any) => val),
    nativeToScVal: vi.fn((_v: any, _o?: any) => ({ _arm: 'mock' })),
    Address: {
      fromString: vi.fn((_a: string) => ({
        toScVal: vi.fn(() => ({ _arm: 'address' })),
        toScAddress: vi.fn(() => ({})),
      })),
    },
    TransactionBuilder: Object.assign(
      vi.fn(function (this: any) {
        this.addOperation = vi.fn().mockReturnThis();
        this.setTimeout = vi.fn().mockReturnThis();
        this.build = vi.fn(() => mockTx);
      }),
      { fromXDR: vi.fn(() => mockTx) }
    ),
    Operation: {
      invokeHostFunction: vi.fn(() => ({})),
      invokeContractFunction: vi.fn(() => ({})),
    },
    Contract: vi.fn(function (this: any) {
      this.call = vi.fn(() => ({}));
    }),
    Account: vi.fn(function (this: any, addr: string) {
      this.accountId = () => addr;
      this.incrementSequenceNumber = vi.fn();
      this.sequenceNumber = () => '100';
    }),
    BASE_FEE: '100',
    xdr: actual.xdr,
  };
});

vi.mock('@/constants', () => ({
  CONTRACT_ID: 'CCONTRACTIDTEST000000000000000000000000000000000000000000',
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  RPC_URL: 'https://soroban-testnet.stellar.org',
  TESTNET_USDC_TOKEN_ID: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  TESTNET_EURC_TOKEN_ID: 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV',
  TESTNET_XLM_TOKEN_ID: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
}));

vi.mock('@/utils/invoiceSubmission', () => ({
  parseAmountToUnits: vi.fn((v: string) => BigInt(Math.floor(parseFloat(v) * 1e6))),
  parseDiscountRateToBps: vi.fn((v: number) => Math.round(v * 100)),
  toUnixTimestamp: vi.fn((d: string) => Math.floor(new Date(d).getTime() / 1000)),
}));

vi.mock('@/lib/horizonClient', () => ({
  fetchNativeXlmBalance: vi.fn(() => Promise.resolve(100.5)),
}));

import {
  getAllInvoices,
  getWalletRoles,
  getNativeXlmBalance,
  getUsdcBalance,
  getTokenAllowance,
  approveToken,
  getUsdcAllowance,
  appealDefault,
  disputeInvoice,
  updateLPWhitelist,
  claimDefault,
  updateInvoice,
  getReferralStats,
  submitInvoiceTransaction,
  buildApproveTokenTransaction,
  buildApproveUsdcTransaction,
  submitSignedTransaction,
  convertInvoiceToken,
  getInsurancePoolInfo,
  getLPInsuranceStatus,
  depositPremium,
  claimInsurance,
  getReputation,
  getReputationEvents,
  getPayerScoresBatch,
  getTopPayers,
  getInvoice,
  getInvoiceCount,
  submitInvoicesBatch,
  listInvoicesBySubmitter,
  listInvoicesByPayer,
  listInvoicesByLp,
  getTopFreelancers,
  getTopLPs,
  submitInvoice,
  adminApproveToken,
  adminRemoveToken,
  getApprovedTokenIds,
  getTokenMetadata,
  getPayerScore,
  type SubmitInvoiceArgs,
} from '@/utils/soroban';
import { rpc, scValToNative, xdr } from '@stellar/stellar-sdk';

const ADDR = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const USDC = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';

function setupSuccess(retval: any = {}) {
  vi.clearAllMocks();
  (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
  (rpc.assembleTransaction as any).mockReturnValue(mockAssembledTx);
  (scValToNative as any).mockReturnValue(retval);
  mockServer.simulateTransaction.mockResolvedValue({ result: { retval } });
  mockServer.getAccount.mockResolvedValue({
    accountId: () => ADDR,
    incrementSequenceNumber: vi.fn(),
    sequenceNumber: () => '100',
  });
  mockServer.getHealth.mockResolvedValue({ status: 'healthy' });
  mockServer.getLatestLedger.mockResolvedValue({ sequence: 100000 });
  mockServer.prepareTransaction.mockResolvedValue(mockTx);
  mockServer.pollTransaction.mockResolvedValue({ status: 'SUCCESS' });
  mockServer.sendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'h123' });
}

describe('soroban – getAllInvoices', () => {
  beforeEach(() => setupSuccess());

  it('returns invoices until consecutive failure', async () => {
    const inv = {
      id: 1n,
      status: { Pending: null },
      freelancer: ADDR,
      payer: ADDR,
      amount: 100n,
      due_date: 1n,
      discount_rate: 100,
    };
    (scValToNative as any).mockReturnValueOnce(inv);
    (rpc.Api.isSimulationSuccess as any).mockReturnValueOnce(true).mockReturnValueOnce(false);
    mockServer.simulateTransaction
      .mockResolvedValueOnce({ result: { retval: {} } })
      .mockResolvedValueOnce({ error: 'not found' });
    const invoices = await getAllInvoices();
    expect(Array.isArray(invoices)).toBe(true);
  });
});

describe('soroban – getWalletRoles', () => {
  it('identifies freelancer role', async () => {
    const inv = {
      id: 1n,
      status: { Pending: null },
      freelancer: ADDR,
      payer: 'OTHER',
      amount: 100n,
      due_date: 1n,
      discount_rate: 100,
    };
    (scValToNative as any).mockReturnValue([inv]);
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: [inv] } });
    const roles = await getWalletRoles(ADDR);
    expect(roles).toContain('freelancer');
  });
});

describe('soroban – getNativeXlmBalance', () => {
  it('returns XLM balance', async () => {
    const bal = await getNativeXlmBalance(ADDR);
    expect(typeof bal).toBe('number');
  });
});

describe('soroban – getUsdcBalance', () => {
  beforeEach(() => setupSuccess(1000000n));
  it('delegates to getTokenBalance', async () => {
    const bal = await getUsdcBalance(ADDR);
    expect(typeof bal).toBe('bigint');
  });
});

describe('soroban – getTokenAllowance', () => {
  beforeEach(() => setupSuccess(500n));
  it('returns allowance as bigint', async () => {
    const a = await getTokenAllowance({ owner: ADDR });
    expect(typeof a).toBe('bigint');
  });
  it('throws on failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    await expect(getTokenAllowance({ owner: ADDR })).rejects.toThrow();
  });
});

describe('soroban – getUsdcAllowance', () => {
  beforeEach(() => setupSuccess(500n));
  it('delegates to getTokenAllowance', async () => {
    const a = await getUsdcAllowance({ owner: ADDR });
    expect(typeof a).toBe('bigint');
  });
});

describe('soroban – approveToken', () => {
  beforeEach(() => setupSuccess());
  it('builds an approve transaction', async () => {
    const tx = await approveToken({ from: ADDR, amount: 1000n });
    expect(tx).toBeDefined();
  });
  it('throws on simulation failure', async () => {
    // getAccount succeeds, but simulateTransaction fails
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    await expect(approveToken({ from: ADDR, amount: 1000n })).rejects.toThrow();
  });
});

describe('soroban – appealDefault', () => {
  it('builds an appeal_default transaction', async () => {
    setupSuccess();
    const tx = await appealDefault(ADDR, 1n, 'evidence_hash_123');
    expect(tx).toBeDefined();
  });
  it('throws on simulation failure', async () => {
    setupSuccess();
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    await expect(appealDefault(ADDR, 1n, 'hash')).rejects.toThrow('Simulation failed');
  });
});

describe('soroban – disputeInvoice', () => {
  beforeEach(() => setupSuccess());
  it('builds a dispute_invoice transaction', async () => {
    const tx = await disputeInvoice(ADDR, 1n, 'reason_hash');
    expect(tx).toBeDefined();
  });
  it('throws on simulation failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    await expect(disputeInvoice(ADDR, 1n, 'hash')).rejects.toThrow('Simulation failed');
  });
});

describe('soroban – updateLPWhitelist', () => {
  it('throws unsupported error', async () => {
    await expect(updateLPWhitelist({ invoiceId: 1n, whitelist: [] })).rejects.toThrow(
      'not supported'
    );
  });
});

describe('soroban – claimDefault', () => {
  beforeEach(() => setupSuccess());
  it('builds a claim_default transaction', async () => {
    const tx = await claimDefault(ADDR, 1n);
    expect(tx).toBeDefined();
  });
  it('throws on simulation failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    await expect(claimDefault(ADDR, 1n)).rejects.toThrow('Simulation failed');
  });
});

describe('soroban – updateInvoice', () => {
  beforeEach(() => setupSuccess());
  it('builds an update_invoice transaction', async () => {
    const r = await updateInvoice({
      freelancer: ADDR,
      invoiceId: 1n,
      amount: 200n,
      dueDate: 1893456000,
      discountRate: 300,
    });
    expect(r.tx).toBeDefined();
  });
  it('throws on simulation failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    await expect(
      updateInvoice({
        freelancer: ADDR,
        invoiceId: 1n,
        amount: 200n,
        dueDate: 1893456000,
        discountRate: 300,
      })
    ).rejects.toThrow();
  });
});

describe('soroban – getReferralStats', () => {
  beforeEach(() => setupSuccess({ total_invoices: 5, total_volume: 1000n }));
  it('returns referral stats on success', async () => {
    const s = await getReferralStats('REF123');
    expect(s.total_invoices).toBe(5);
  });
  it('returns zero stats on failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    const s = await getReferralStats('NOPE');
    expect(s.total_invoices).toBe(0);
    expect(s.total_volume).toBe(0n);
  });
});

describe('soroban – submitInvoiceTransaction', () => {
  beforeEach(() => {
    setupSuccess(42n);
    (rpc.Api as any).GetTransactionStatus = { SUCCESS: 'SUCCESS' };
  });
  it('returns invoiceId and txHash on success', async () => {
    const r = await submitInvoiceTransaction({
      freelancer: ADDR,
      payer: ADDR,
      amount: 100n,
      dueDate: 1893456000,
      discountRate: 250,
      signTx: async () => 'signedXDR',
    });
    expect(r.txHash).toBe('h123');
    expect(typeof r.invoiceId).toBe('bigint');
  });
  it('throws on simulation failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'err' });
    await expect(
      submitInvoiceTransaction({
        freelancer: ADDR,
        payer: ADDR,
        amount: 100n,
        dueDate: 1893456000,
        discountRate: 250,
        signTx: async () => 'signedXDR',
      })
    ).rejects.toThrow('Simulation failed');
  });
  it('throws when send returns invalid response', async () => {
    mockServer.sendTransaction.mockResolvedValue({});
    await expect(
      submitInvoiceTransaction({
        freelancer: ADDR,
        payer: ADDR,
        amount: 100n,
        dueDate: 1893456000,
        discountRate: 250,
        signTx: async () => 'signedXDR',
      })
    ).rejects.toThrow('invalid response');
  });
  it('throws when send status is rejected', async () => {
    mockServer.sendTransaction.mockResolvedValue({ hash: 'h', status: 'ERROR' });
    await expect(
      submitInvoiceTransaction({
        freelancer: ADDR,
        payer: ADDR,
        amount: 100n,
        dueDate: 1893456000,
        discountRate: 250,
        signTx: async () => 'signedXDR',
      })
    ).rejects.toThrow('failed with status');
  });
  it('throws when poll returns non-success', async () => {
    mockServer.pollTransaction.mockResolvedValue({ status: 'FAILED' });
    await expect(
      submitInvoiceTransaction({
        freelancer: ADDR,
        payer: ADDR,
        amount: 100n,
        dueDate: 1893456000,
        discountRate: 250,
        signTx: async () => 'signedXDR',
      })
    ).rejects.toThrow('failed with status');
  });
  it('includes referral code when provided', async () => {
    const r = await submitInvoiceTransaction({
      freelancer: ADDR,
      payer: ADDR,
      amount: 100n,
      dueDate: 1893456000,
      discountRate: 250,
      signTx: async () => 'signedXDR',
      referralCode: 'REF',
    });
    expect(r.txHash).toBeDefined();
  });
});

describe('soroban – buildApproveTokenTransaction', () => {
  beforeEach(() => setupSuccess());
  it('builds an approve token tx', async () => {
    const tx = await buildApproveTokenTransaction({ owner: ADDR, amount: 1000n });
    expect(tx).toBeDefined();
  });
  it('throws on simulation failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    await expect(buildApproveTokenTransaction({ owner: ADDR, amount: 1000n })).rejects.toThrow();
  });
});

describe('soroban – buildApproveUsdcTransaction', () => {
  beforeEach(() => setupSuccess());
  it('delegates to buildApproveTokenTransaction', async () => {
    const tx = await buildApproveUsdcTransaction({ owner: ADDR, amount: 1000n });
    expect(tx).toBeDefined();
  });
});

describe('soroban – submitSignedTransaction', () => {
  beforeEach(() => {
    setupSuccess();
    (rpc.Api as any).GetTransactionStatus = { SUCCESS: 'SUCCESS' };
  });
  it('returns txHash on success', async () => {
    const r = await submitSignedTransaction({ tx: mockTx, signTx: async () => 'signedXDR' });
    expect(r.txHash).toBe('h123');
  });
  it('throws on invalid send response', async () => {
    mockServer.sendTransaction.mockResolvedValue({});
    await expect(submitSignedTransaction({ tx: mockTx, signTx: async () => 'x' })).rejects.toThrow(
      'invalid'
    );
  });
  it('throws on rejected status', async () => {
    mockServer.sendTransaction.mockResolvedValue({ hash: 'h', status: 'ERROR' });
    await expect(submitSignedTransaction({ tx: mockTx, signTx: async () => 'x' })).rejects.toThrow(
      'failed with status'
    );
  });
  it('throws on poll failure', async () => {
    mockServer.pollTransaction.mockResolvedValue({ status: 'FAILED' });
    await expect(submitSignedTransaction({ tx: mockTx, signTx: async () => 'x' })).rejects.toThrow(
      'failed with status'
    );
  });
});

describe('soroban – convertInvoiceToken', () => {
  beforeEach(() => setupSuccess());
  it('builds a convert_invoice_token tx', async () => {
    const tx = await convertInvoiceToken(ADDR, 1n, USDC);
    expect(tx).toBeDefined();
  });
  it('throws on simulation failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    await expect(convertInvoiceToken(ADDR, 1n, USDC)).rejects.toThrow();
  });
});

describe('soroban – getInsurancePoolInfo', () => {
  it('returns parsed info on success', async () => {
    setupSuccess({ balance: 1000n, enrolled_count: 5, premium_rate: 50 });
    const info = await getInsurancePoolInfo();
    expect(info.enrolled_count).toBe(5);
  });
  it('returns fallback on simulation failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    const info = await getInsurancePoolInfo();
    expect(info.enrolled_count).toBe(12);
  });
  it('returns fallback on exception', async () => {
    mockServer.simulateTransaction.mockRejectedValue(new Error('network'));
    const info = await getInsurancePoolInfo();
    expect(info.enrolled_count).toBe(12);
  });
});

describe('soroban – getLPInsuranceStatus', () => {
  beforeEach(() => setupSuccess(true));
  it('returns true when enrolled', async () => {
    (scValToNative as any).mockReturnValue(true);
    const s = await getLPInsuranceStatus(ADDR);
    expect(s).toBe(true);
  });
  it('returns false on failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    const s = await getLPInsuranceStatus(ADDR);
    expect(s).toBe(false);
  });
  it('returns false on exception', async () => {
    mockServer.simulateTransaction.mockRejectedValue(new Error('err'));
    const s = await getLPInsuranceStatus(ADDR);
    expect(s).toBe(false);
  });
});

describe('soroban – depositPremium', () => {
  beforeEach(() => setupSuccess());
  it('builds a deposit_premium tx', async () => {
    const tx = await depositPremium(ADDR, 1000n);
    expect(tx).toBeDefined();
  });
  it('throws on simulation failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    await expect(depositPremium(ADDR, 1000n)).rejects.toThrow();
  });
});

describe('soroban – claimInsurance', () => {
  beforeEach(() => setupSuccess());
  it('builds a claim tx', async () => {
    const tx = await claimInsurance(ADDR, 1n);
    expect(tx).toBeDefined();
  });
  it('throws on simulation failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    await expect(claimInsurance(ADDR, 1n)).rejects.toThrow();
  });
});

describe('soroban – getReputation', () => {
  it('returns reputation on success', async () => {
    setupSuccess({ score: 90, invoices_submitted: 10, invoices_paid: 8, invoices_defaulted: 1 });
    const r = await getReputation(ADDR);
    expect(r).not.toBeNull();
    expect(r!.score).toBe(90);
  });
  it('returns null on failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    const r = await getReputation(ADDR);
    expect(r).toBeNull();
  });
  it('returns null on null retval', async () => {
    setupSuccess(null);
    (scValToNative as any).mockReturnValue(null);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: null } });
    const r = await getReputation(ADDR);
    expect(r).toBeNull();
  });
  it('returns null on exception', async () => {
    mockServer.simulateTransaction.mockRejectedValue(new Error('err'));
    const r = await getReputation(ADDR);
    expect(r).toBeNull();
  });
});

describe('soroban – getReputationEvents', () => {
  it('returns events on success', async () => {
    setupSuccess([{ type: 'paid', timestamp: 1000, score: 80 }]);
    (scValToNative as any).mockReturnValue([{ type: 'paid', timestamp: 1000, score: 80 }]);
    const evts = await getReputationEvents(ADDR);
    expect(evts).toHaveLength(1);
    expect(evts[0].type).toBe('paid');
  });
  it('returns empty on failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    const evts = await getReputationEvents(ADDR);
    expect(evts).toEqual([]);
  });
  it('returns empty on non-array', async () => {
    setupSuccess('not-array');
    (scValToNative as any).mockReturnValue('not-array');
    const evts = await getReputationEvents(ADDR);
    expect(evts).toEqual([]);
  });
  it('filters events with invalid timestamps', async () => {
    setupSuccess([
      { type: 'paid', timestamp: 0 },
      { type: 'submitted', timestamp: 500 },
    ]);
    (scValToNative as any).mockReturnValue([
      { type: 'paid', timestamp: 0 },
      { type: 'submitted', timestamp: 500 },
    ]);
    const evts = await getReputationEvents(ADDR);
    expect(evts).toHaveLength(1);
  });
  it('returns empty on exception', async () => {
    mockServer.simulateTransaction.mockRejectedValue(new Error('err'));
    const evts = await getReputationEvents(ADDR);
    expect(evts).toEqual([]);
  });
});

describe('soroban – getPayerScoresBatch', () => {
  it('returns a map of scores', async () => {
    setupSuccess({ score: 85, settled_on_time: 10, defaults: 1 });
    const map = await getPayerScoresBatch([ADDR]);
    expect(map.get(ADDR)).toMatchObject({ score: 85 });
  });
  it('deduplicates addresses', async () => {
    setupSuccess({ score: 85, settled_on_time: 10, defaults: 1 });
    const map = await getPayerScoresBatch([ADDR, ADDR]);
    expect(map.size).toBe(1);
  });
});

describe('soroban – getTopPayers', () => {
  it('returns array of top payers on success', async () => {
    setupSuccess([
      { address: ADDR, score: 90, invoices_paid: 10, invoices_defaulted: 0, total_volume: 1000n },
    ]);
    (scValToNative as any).mockReturnValue([
      { address: ADDR, score: 90, invoices_paid: 10, invoices_defaulted: 0, total_volume: 1000n },
    ]);
    const payers = await getTopPayers(10);
    expect(payers).toHaveLength(1);
  });
  it('returns empty on failure', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    const payers = await getTopPayers();
    expect(payers).toEqual([]);
  });
  it('returns empty on non-array result', async () => {
    setupSuccess('not-array');
    (scValToNative as any).mockReturnValue('not-array');
    const payers = await getTopPayers();
    expect(payers).toEqual([]);
  });
  it('returns empty on exception', async () => {
    mockServer.simulateTransaction.mockRejectedValue(new Error('err'));
    const payers = await getTopPayers();
    expect(payers).toEqual([]);
  });
});

describe('soroban – getInvoiceCount additional', () => {
  it('throws when simulation fails after healthy check', async () => {
    setupSuccess();
    mockServer.getHealth.mockResolvedValue({ status: 'healthy' });
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    await expect(getInvoiceCount()).rejects.toThrow('Failed to get invoice count');
  });
});

describe('soroban – submitInvoicesBatch', () => {
  beforeEach(() => {
    setupSuccess(42n);
    (rpc.Api as any).GetTransactionStatus = { SUCCESS: 'SUCCESS' };
  });

  it('submits a single invoice batch successfully', async () => {
    const results = await submitInvoicesBatch(
      ADDR,
      [{ payer: ADDR, amount: '100', dueDate: '2026-01-01', discountRate: '5', tokenId: USDC }],
      async () => 'signedXDR'
    );
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].id).toBe('invoice-1');
  });

  it('handles individual invoice failure gracefully', async () => {
    // First call succeeds, second call fails simulation
    mockServer.simulateTransaction
      .mockResolvedValueOnce({ result: { retval: 42n } })
      .mockResolvedValueOnce({ error: 'fail' });
    (rpc.Api.isSimulationSuccess as any).mockReturnValueOnce(true).mockReturnValueOnce(false);

    const results = await submitInvoicesBatch(
      ADDR,
      [
        { payer: ADDR, amount: '100', dueDate: '2026-01-01', discountRate: '5', tokenId: USDC },
        { payer: ADDR, amount: '200', dueDate: '2026-02-01', discountRate: '3', tokenId: USDC },
      ],
      async () => 'signedXDR'
    );
    expect(results).toHaveLength(2);
    // At least one should have failed
    expect(results.some((r) => !r.success)).toBe(true);
  });

  it('returns empty results for empty invoice list', async () => {
    const results = await submitInvoicesBatch(ADDR, [], async () => 'signedXDR');
    expect(results).toEqual([]);
  });

  it('handles invalid invoice data', async () => {
    // parseAmountToUnits returns 0n for "0", which is falsy
    const { parseAmountToUnits } = await import('@/utils/invoiceSubmission');
    (parseAmountToUnits as any).mockReturnValueOnce(0n);

    const results = await submitInvoicesBatch(
      ADDR,
      [{ payer: ADDR, amount: '0', dueDate: '2026-01-01', discountRate: '5', tokenId: USDC }],
      async () => 'signedXDR'
    );
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
  });
});

describe('soroban – getWalletRoles extended', () => {
  it('identifies payer role', async () => {
    setupSuccess();
    const inv = {
      id: 1n,
      status: { Pending: null },
      freelancer: 'OTHER',
      payer: ADDR,
      amount: 100n,
      due_date: 1n,
      discount_rate: 100,
    };
    (scValToNative as any).mockReturnValue([inv]);
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: [inv] } });
    const roles = await getWalletRoles(ADDR);
    expect(roles).toContain('payer');
  });

  it('identifies lp role from funder field', async () => {
    setupSuccess();
    const inv = {
      id: 1n,
      status: { Funded: null },
      freelancer: 'OTHER',
      payer: 'OTHER2',
      funder: ADDR,
      amount: 100n,
      due_date: 1n,
      discount_rate: 100,
    };
    (scValToNative as any).mockReturnValue([inv]);
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: [inv] } });
    const roles = await getWalletRoles(ADDR);
    expect(roles).toContain('lp');
  });

  it('returns empty roles when no invoices match', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    const roles = await getWalletRoles(ADDR);
    expect(roles).toEqual([]);
  });
});

describe('soroban – getInvoice parseStatus branches', () => {
  beforeEach(() => setupSuccess());

  it('parses string status directly', async () => {
    (scValToNative as any).mockReturnValue({
      id: 1n,
      freelancer: ADDR,
      payer: ADDR,
      amount: 100n,
      due_date: 1n,
      discount_rate: 100,
      status: 'Pending',
      funder: undefined,
      funded_at: undefined,
      token: USDC,
    });
    const inv = await getInvoice(1n);
    expect(inv.status).toBe('Pending');
  });
});

describe('soroban – submitInvoiceTransaction sim error without error field', () => {
  beforeEach(() => {
    setupSuccess(42n);
    (rpc.Api as any).GetTransactionStatus = { SUCCESS: 'SUCCESS' };
  });

  it('uses fallback message when simulated has no error field', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    // No 'error' field - should fall back to generic message
    mockServer.simulateTransaction.mockResolvedValue({ result: null });
    await expect(
      submitInvoiceTransaction({
        freelancer: ADDR,
        payer: ADDR,
        amount: 100n,
        dueDate: 1893456000,
        discountRate: 250,
        signTx: async () => 'signedXDR',
      })
    ).rejects.toThrow('Simulation failed');
  });
});

describe('soroban – getReferralStats exception path', () => {
  it('returns zero stats on exception', async () => {
    mockServer.simulateTransaction.mockRejectedValue(new Error('network error'));
    const s = await getReferralStats('CODE');
    expect(s.total_invoices).toBe(0);
    expect(s.total_volume).toBe(0n);
  });
});

describe('soroban – getPayerScore exception path', () => {
  it('returns null when simulateTransaction throws', async () => {
    const { getPayerScore } = await import('@/utils/soroban');
    mockServer.simulateTransaction.mockRejectedValue(new Error('network'));
    const score = await getPayerScore(ADDR);
    expect(score).toBeNull();
  });
});

// ── listInvoicesBySubmitter / listInvoicesByPayer / listInvoicesByLp — exception paths ──

describe('soroban – listInvoicesBySubmitter exception path', () => {
  it('returns [] when simulateTransaction throws', async () => {
    setupSuccess();
    mockServer.simulateTransaction.mockRejectedValue(new Error('rpc down'));
    const result = await listInvoicesBySubmitter(ADDR);
    expect(result).toEqual([]);
  });
});

describe('soroban – listInvoicesByPayer exception path', () => {
  it('returns [] when simulateTransaction throws', async () => {
    setupSuccess();
    mockServer.simulateTransaction.mockRejectedValue(new Error('rpc down'));
    const result = await listInvoicesByPayer(ADDR);
    expect(result).toEqual([]);
  });
});

describe('soroban – listInvoicesByLp exception path', () => {
  it('returns [] when simulateTransaction throws', async () => {
    setupSuccess();
    mockServer.simulateTransaction.mockRejectedValue(new Error('rpc down'));
    const result = await listInvoicesByLp(ADDR);
    expect(result).toEqual([]);
  });
});

// ── getTopFreelancers ────────────────────────────────────────────────────────

describe('soroban – getTopFreelancers', () => {
  it('returns array of top freelancers on success', async () => {
    setupSuccess([
      {
        address: ADDR,
        score: 95,
        invoices_submitted: 20,
        invoices_funded: 18,
        total_earned: 5000n,
      },
    ]);
    (scValToNative as any).mockReturnValue([
      {
        address: ADDR,
        score: 95,
        invoices_submitted: 20,
        invoices_funded: 18,
        total_earned: 5000n,
      },
    ]);
    const freelancers = await getTopFreelancers(10);
    expect(freelancers).toHaveLength(1);
    expect(freelancers[0]).toMatchObject({
      address: ADDR,
      score: 95,
      invoices_submitted: 20,
      invoices_funded: 18,
      total_earned: 5000n,
    });
  });

  it('returns empty on failed simulation', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    const freelancers = await getTopFreelancers();
    expect(freelancers).toEqual([]);
  });

  it('returns empty on non-array result', async () => {
    setupSuccess('not-array');
    (scValToNative as any).mockReturnValue('not-array');
    const freelancers = await getTopFreelancers();
    expect(freelancers).toEqual([]);
  });

  it('returns empty and logs on exception', async () => {
    setupSuccess();
    mockServer.simulateTransaction.mockRejectedValue(new Error('network'));
    const freelancers = await getTopFreelancers();
    expect(freelancers).toEqual([]);
  });
});

// ── getTopLPs ─────────────────────────────────────────────────────────────────

describe('soroban – getTopLPs', () => {
  it('returns array of top LPs on success', async () => {
    setupSuccess([
      {
        address: ADDR,
        liquidity_provided: 100000n,
        fees_earned: 250n,
        total_funded: 12,
        score: 80,
      },
    ]);
    (scValToNative as any).mockReturnValue([
      {
        address: ADDR,
        liquidity_provided: 100000n,
        fees_earned: 250n,
        total_funded: 12,
        score: 80,
      },
    ]);
    const lps = await getTopLPs(10);
    expect(lps).toHaveLength(1);
    expect(lps[0]).toMatchObject({
      address: ADDR,
      liquidity_provided: 100000n,
      fees_earned: 250n,
      total_funded: 12,
      score: 80,
    });
  });

  it('returns empty on failed simulation', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });
    const lps = await getTopLPs();
    expect(lps).toEqual([]);
  });

  it('returns empty on non-array result', async () => {
    setupSuccess('not-array');
    (scValToNative as any).mockReturnValue('not-array');
    const lps = await getTopLPs();
    expect(lps).toEqual([]);
  });

  it('returns empty and logs on exception', async () => {
    setupSuccess();
    mockServer.simulateTransaction.mockRejectedValue(new Error('network'));
    const lps = await getTopLPs();
    expect(lps).toEqual([]);
  });
});

// ── submitInvoice — plain (non-object) retval branch ───────────────────────────

describe('soroban – submitInvoice plain numeric retval', () => {
  const validArgs: SubmitInvoiceArgs = {
    freelancer: ADDR,
    payer: ADDR,
    amount: 125_000_000n,
    dueDate: 1893456000,
    discountRate: 250,
  };

  it('extracts invoiceId directly when retval is a plain bigint (not ok/Ok wrapped)', async () => {
    setupSuccess(77n);
    (scValToNative as any).mockReturnValue(77n);
    const result = await submitInvoice(validArgs);
    expect(result.invoiceId).toBe(77n);
  });
});

// ── extractInvoiceIdFromTransaction (via submitInvoiceTransaction) ─────────────
// extractInvoiceIdFromTransaction is a private helper only reachable through
// submitInvoiceTransaction's `finalResult` (the resolved value of
// server.pollTransaction). These tests exercise its returnValue-as-ScVal,
// returnValue-as-base64-string (success + parse-failure), and
// resultMetaXdr-based (success + parse-failure) branches using the REAL
// stellar-sdk `xdr` module (mocked pass-through: `xdr: actual.xdr`).

function buildTransactionMetaV3Xdr(returnValue: InstanceType<typeof xdr.ScVal>): string {
  const ext = new (xdr as any).ExtensionPoint(0, undefined);
  const sorobanExt = new (xdr as any).SorobanTransactionMetaExt(0, undefined);
  const sorobanMeta = new (xdr as any).SorobanTransactionMeta({
    ext: sorobanExt,
    events: [],
    returnValue,
    diagnosticEvents: [],
  });
  const v3 = new (xdr as any).TransactionMetaV3({
    ext,
    txChangesBefore: [],
    operations: [],
    txChangesAfter: [],
    sorobanMeta,
  });
  const meta = new (xdr as any).TransactionMeta(3, v3);
  return meta.toXDR('base64');
}

describe('soroban – extractInvoiceIdFromTransaction branches', () => {
  const args = {
    freelancer: ADDR,
    payer: ADDR,
    amount: 100n,
    dueDate: 1893456000,
    discountRate: 250,
    signTx: async () => 'signedXDR',
  };

  beforeEach(() => {
    setupSuccess(42n);
    (rpc.Api as any).GetTransactionStatus = { SUCCESS: 'SUCCESS' };
  });

  it('extracts invoiceId when finalResult.returnValue is a real xdr.ScVal instance', async () => {
    const scVal = xdr.ScVal.scvU32(7);
    mockServer.pollTransaction.mockResolvedValue({ status: 'SUCCESS', returnValue: scVal });
    // scValToNative is mocked; make it return a distinguishable value for this call.
    (scValToNative as any).mockImplementation((val: any) =>
      val === scVal || val instanceof xdr.ScVal ? 501n : 42n
    );
    const result = await submitInvoiceTransaction(args);
    expect(result.invoiceId).toBe(501n);
  });

  it('extracts invoiceId when finalResult.returnValue is a base64 XDR string', async () => {
    const base64 = xdr.ScVal.scvU32(9).toXDR('base64');
    mockServer.pollTransaction.mockResolvedValue({ status: 'SUCCESS', returnValue: base64 });
    (scValToNative as any).mockImplementation((val: any) =>
      val instanceof xdr.ScVal ? 502n : 42n
    );
    const result = await submitInvoiceTransaction(args);
    expect(result.invoiceId).toBe(502n);
  });

  it('falls back to simulatedInvoiceId when returnValue string fails to parse as XDR', async () => {
    mockServer.pollTransaction.mockResolvedValue({
      status: 'SUCCESS',
      returnValue: 'not-valid-base64-xdr!!!',
    });
    const result = await submitInvoiceTransaction(args);
    // extractInvoiceIdFromTransaction returns null on parse failure, so the
    // simulated invoice ID (42n, from setupSuccess(42n)) is used instead.
    expect(result.invoiceId).toBe(42n);
  });

  it('extracts invoiceId from resultMetaXdr when present', async () => {
    const returnValue = xdr.ScVal.scvU32(11);
    const resultMetaXdr = buildTransactionMetaV3Xdr(returnValue);
    mockServer.pollTransaction.mockResolvedValue({ status: 'SUCCESS', resultMetaXdr });
    (scValToNative as any).mockImplementation((val: any) =>
      val instanceof xdr.ScVal ? 503n : 42n
    );
    const result = await submitInvoiceTransaction(args);
    expect(result.invoiceId).toBe(503n);
  });

  it('falls back to simulatedInvoiceId when resultMetaXdr fails to parse', async () => {
    mockServer.pollTransaction.mockResolvedValue({
      status: 'SUCCESS',
      resultMetaXdr: 'garbage-not-a-real-transaction-meta',
    });
    const result = await submitInvoiceTransaction(args);
    expect(result.invoiceId).toBe(42n);
  });
});

// ── submitInvoicesBatch — Promise.allSettled rejection fallback + batch delay ──

describe('soroban – submitInvoicesBatch rejection fallback message', () => {
  it('uses the default fallback error message when a batch promise itself rejects', async () => {
    setupSuccess(42n);
    (rpc.Api as any).GetTransactionStatus = { SUCCESS: 'SUCCESS' };

    // Force Promise.allSettled to report one rejected settlement, simulating
    // a scenario the per-invoice try/catch didn't anticipate (defensive
    // code path at the allSettled aggregation layer).
    const allSettledSpy = vi
      .spyOn(Promise, 'allSettled')
      .mockResolvedValueOnce([{ status: 'rejected', reason: {} }] as any);

    const results = await submitInvoicesBatch(
      ADDR,
      [{ payer: ADDR, amount: '100', dueDate: '2026-01-01', discountRate: '5', tokenId: USDC }],
      async () => 'signedXDR'
    );

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBe('Batch processing failed');

    allSettledSpy.mockRestore();
  });
});

// ── getWalletRoles — fallback loop over getAllInvoices ─────────────────────────

describe('soroban – getWalletRoles fallback loop', () => {
  it('derives all three roles from getAllInvoices, including a non-matching invoice, when the batched list_invoices_by_* calls all return empty', async () => {
    setupSuccess();

    // Four invoices returned in sequence by getAllInvoices()'s repeated
    // getInvoice(1..4) calls: one matches on freelancer, one matches on
    // nothing (exercises the `if (...) roles.add(...)` false branches),
    // one matches on payer, and one matches on funder (lp).
    const canned = [
      {
        id: 1n,
        status: { Funded: null },
        freelancer: ADDR,
        payer: 'GNOMATCH1',
        funder: 'GNOMATCH2',
        amount: 100n,
        due_date: 1n,
        discount_rate: 100,
      },
      {
        id: 2n,
        status: { Pending: null },
        freelancer: 'GNOMATCH3',
        payer: 'GNOMATCH4',
        funder: 'GNOMATCH5',
        amount: 100n,
        due_date: 1n,
        discount_rate: 100,
      },
      {
        id: 3n,
        status: { Funded: null },
        freelancer: 'GNOMATCH6',
        payer: ADDR,
        funder: 'GNOMATCH7',
        amount: 100n,
        due_date: 1n,
        discount_rate: 100,
      },
      {
        id: 4n,
        status: { Funded: null },
        freelancer: 'GNOMATCH8',
        payer: 'GNOMATCH9',
        funder: ADDR,
        amount: 100n,
        due_date: 1n,
        discount_rate: 100,
      },
    ];

    // Calls 1-3: the Promise.all([listInvoicesBySubmitter, ByPayer, ByLp])
    // trio, all resolving successfully with an empty array so roles.size
    // stays 0 and getWalletRoles falls through to the getAllInvoices()
    // fallback loop. Calls 4-7: getInvoice(1..4) inside getAllInvoices,
    // each returning one of the canned invoices above. Call 8: getInvoice(5)
    // fails, which stops getAllInvoices' 1-failure loop.
    let callCount = 0;
    mockServer.simulateTransaction.mockImplementation(() => {
      callCount++;
      if (callCount <= 3) return Promise.resolve({ result: { retval: [] } });
      if (callCount <= 7) return Promise.resolve({ result: { retval: {} } });
      return Promise.resolve({ error: 'not found' });
    });
    (scValToNative as any).mockImplementation(() => {
      if (callCount <= 3) return [];
      if (callCount <= 7) return canned[callCount - 4];
      return undefined;
    });
    (rpc.Api.isSimulationSuccess as any).mockImplementation(() => callCount <= 7);

    const roles = await getWalletRoles(ADDR);
    expect(roles).toContain('freelancer');
    expect(roles).toContain('payer');
    expect(roles).toContain('lp');
  });
});

describe('soroban – submitInvoicesBatch multi-batch delay', () => {
  it('waits between batches when there are more invoices than the batch size', async () => {
    setupSuccess(42n);
    (rpc.Api as any).GetTransactionStatus = { SUCCESS: 'SUCCESS' };

    vi.useFakeTimers();
    const invoices = Array.from({ length: 6 }, () => ({
      payer: ADDR,
      amount: '100',
      dueDate: '2026-01-01',
      discountRate: '5',
      tokenId: USDC,
    }));
    const promise = submitInvoicesBatch(ADDR, invoices, async () => 'signedXDR');
    await vi.runAllTimersAsync();
    const results = await promise;
    vi.useRealTimers();

    expect(results).toHaveLength(6);
    expect(results.every((r) => r.success)).toBe(true);
  });
});

// ── adminApproveToken / adminRemoveToken ────────────────────────────────────────

describe('soroban – adminApproveToken', () => {
  beforeEach(() => setupSuccess());

  it('builds an add_token transaction', async () => {
    const tx = await adminApproveToken(ADDR, USDC);
    expect(tx).toBeDefined();
    expect(mockServer.getAccount).toHaveBeenCalledWith(ADDR);
  });

  it('throws when simulation fails', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'not authorized' });
    await expect(adminApproveToken(ADDR, USDC)).rejects.toThrow('Simulation failed');
  });
});

describe('soroban – adminRemoveToken', () => {
  beforeEach(() => setupSuccess());

  it('builds a remove_token transaction', async () => {
    const tx = await adminRemoveToken(ADDR, USDC);
    expect(tx).toBeDefined();
    expect(mockServer.getAccount).toHaveBeenCalledWith(ADDR);
  });

  it('throws when simulation fails', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'not authorized' });
    await expect(adminRemoveToken(ADDR, USDC)).rejects.toThrow('Simulation failed');
  });
});

// ── getAllInvoices — 1000-invoice safety cap ────────────────────────────────────

describe('soroban – getAllInvoices safety cap', () => {
  it('stops at exactly 1000 invoices even if every getInvoice call keeps succeeding', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (scValToNative as any).mockReturnValue({
      id: 1n,
      freelancer: ADDR,
      payer: ADDR,
      amount: 1n,
      due_date: 1n,
      discount_rate: 1,
      status: { Pending: null },
    });
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });

    const invoices = await getAllInvoices();
    expect(invoices).toHaveLength(1000);
  }, 20000);
});

// ── parseInvoiceFromNative — field-alias / default-value fallbacks ─────────────

describe('soroban – parseInvoiceFromNative fallback fields (via listInvoicesBySubmitter)', () => {
  it('falls back through submitter alias and default values for missing fields', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);

    const invoiceWithSubmitterAlias = {
      // id, payer, amount, due_date, discount_rate all omitted -> defaults
      submitter: 'GSUBMITTERALIAS',
      status: { Pending: null },
      funded_at: 555,
      token: 'CSOMETOKEN',
    };
    const invoiceWithNoAliasesAtAll = {
      // freelancer AND submitter both omitted -> '' fallback
      payer: 'GPAYERONLY',
      amount: 10n,
      id: 2n,
      due_date: 5n,
      discount_rate: 10,
      status: { Pending: null },
    };

    mockServer.simulateTransaction.mockResolvedValue({
      result: { retval: [invoiceWithSubmitterAlias, invoiceWithNoAliasesAtAll] },
    });
    (scValToNative as any).mockReturnValue([invoiceWithSubmitterAlias, invoiceWithNoAliasesAtAll]);

    const invoices = await listInvoicesBySubmitter(ADDR);
    expect(invoices).toHaveLength(2);

    const [first, second] = invoices;
    expect(first.id).toBe(0n);
    expect(first.freelancer).toBe('GSUBMITTERALIAS');
    expect(first.payer).toBe('');
    expect(first.amount).toBe(0n);
    expect(first.due_date).toBe(0n);
    expect(first.discount_rate).toBe(0);
    expect(first.funded_at).toBe(555n);
    expect(first.token).toBe('CSOMETOKEN');

    expect(second.freelancer).toBe('');
  });
});

// ── list* functions — non-array retval branch ───────────────────────────────────

describe('soroban – list* functions return [] when parsed retval is not an array', () => {
  it('listInvoicesBySubmitter', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });
    (scValToNative as any).mockReturnValue({ not: 'an array' });
    const result = await listInvoicesBySubmitter(ADDR);
    expect(result).toEqual([]);
  });

  it('listInvoicesByPayer', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });
    (scValToNative as any).mockReturnValue({ not: 'an array' });
    const result = await listInvoicesByPayer(ADDR);
    expect(result).toEqual([]);
  });

  it('listInvoicesByLp', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });
    (scValToNative as any).mockReturnValue({ not: 'an array' });
    const result = await listInvoicesByLp(ADDR);
    expect(result).toEqual([]);
  });
});

// ── getApprovedTokenIds — non-array branch ──────────────────────────────────────

describe('soroban – getApprovedTokenIds non-array branch', () => {
  it('returns [] when the parsed native value is not an array', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });
    (scValToNative as any).mockReturnValue('not-an-array');
    const tokens = await getApprovedTokenIds();
    expect(tokens).toEqual([]);
  });
});

// ── getTokenMetadata — unknown-token literal fallbacks + non-finite decimals ───

describe('soroban – getTokenMetadata fallback branches', () => {
  const UNKNOWN_TOKEN = 'CUNKNOWNTOKENIDNOTINKNOWNMETADATAMAPXXXXXXXXXXXXXXXXXXXXXX';

  it('falls back to literal Token/TOKEN/7 when the token is unknown and all reads fail', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' });

    const meta = await getTokenMetadata(UNKNOWN_TOKEN);
    expect(meta.name).toBe('Token');
    expect(meta.symbol).toBe('TOKEN');
    expect(meta.decimals).toBe(7);
  });

  it('falls back to 7 decimals when the resolved decimals value is not finite', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });
    // name, symbol, decimals reads happen concurrently in that declared
    // order; queue matching scValToNative return values.
    (scValToNative as any)
      .mockReturnValueOnce('Custom Token')
      .mockReturnValueOnce('CUSTOM')
      .mockReturnValueOnce('not-a-number');

    const meta = await getTokenMetadata(USDC);
    expect(meta.decimals).toBe(7);
  });
});

// ── getPayerScore — native-null-after-truthy-retval + raw-value fallback ───────

describe('soroban – getPayerScore additional branches', () => {
  it('returns null when the parsed native value is null (retval itself was truthy)', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });
    (scValToNative as any).mockReturnValue(null);
    const score = await getPayerScore(ADDR);
    expect(score).toBeNull();
  });

  it('falls back to using the raw native value as score when native.score is absent', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });
    // A bare bigint has no .score/.settled_on_time/.defaults properties, so
    // all three `?? ` fallbacks in getPayerScore are exercised at once.
    (scValToNative as any).mockReturnValue(85n);
    const score = await getPayerScore(ADDR);
    expect(score).toMatchObject({ score: 85, settled_on_time: 0, defaults: 0 });
  });
});

// ── getReputation — native-null-after-truthy-retval + alias/default chains ─────

describe('soroban – getReputation additional branches', () => {
  it('returns null when the parsed native value is null (retval itself was truthy)', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });
    (scValToNative as any).mockReturnValue(null);
    const rep = await getReputation(ADDR);
    expect(rep).toBeNull();
  });

  it('falls back through score/count aliases and reports last_activity_ledger when present', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });

    (scValToNative as any).mockReturnValueOnce({
      reputation_score: 77,
      submitted: 5,
      paid: 3,
      defaulted: 1,
      last_activity_ledger: 12345,
    });
    const repA = await getReputation(ADDR);
    expect(repA).toMatchObject({
      score: 77,
      invoices_submitted: 5,
      invoices_paid: 3,
      invoices_defaulted: 1,
      last_activity_ledger: 12345,
    });
  });

  it('falls back to second-level aliases (settled_on_time / defaults)', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });

    (scValToNative as any).mockReturnValueOnce({
      settled_on_time: 9,
      defaults: 2,
    });
    const repB = await getReputation(ADDR);
    expect(repB).toMatchObject({
      score: 0,
      invoices_submitted: 0,
      invoices_paid: 9,
      invoices_defaulted: 2,
      last_activity_ledger: undefined,
    });
  });

  it('falls all the way through to 0 defaults when no aliases are present', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });

    (scValToNative as any).mockReturnValueOnce({
      score: 50,
      invoices_submitted: 3,
    });
    const repC = await getReputation(ADDR);
    expect(repC).toMatchObject({
      score: 50,
      invoices_submitted: 3,
      invoices_paid: 0,
      invoices_defaulted: 0,
    });
  });
});

// ── getReputationEvents — type/timestamp alias chains ───────────────────────────

describe('soroban – getReputationEvents alias fallbacks', () => {
  it('falls back through event/ledger_time aliases and the score_updated/0 defaults', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });

    const events = [
      { event: 'paid', ledger_time: 500 }, // type/timestamp alias path
      {}, // both type and timestamp fall through to final defaults
    ];
    (scValToNative as any).mockReturnValue(events);

    const result = await getReputationEvents(ADDR);
    // Only the first event has a timestamp > 0 and survives the filter;
    // the second (timestamp defaults to 0) is filtered out — but both
    // branches were still evaluated during the .map() pass.
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('paid');
    expect(result[0].timestamp).toBe(500);
  });
});

// ── getPayerScoresBatch — rejected settlement branch ────────────────────────────

describe('soroban – getPayerScoresBatch rejected settlement', () => {
  it('maps a rejected settlement to null', async () => {
    setupSuccess();
    // getPayerScore itself always catches its own errors and never rejects,
    // so force Promise.allSettled to report a rejected entry to exercise
    // the `result.status === 'fulfilled' ? ... : null` false branch.
    const allSettledSpy = vi
      .spyOn(Promise, 'allSettled')
      .mockResolvedValueOnce([{ status: 'rejected', reason: new Error('boom') }] as any);

    const map = await getPayerScoresBatch([ADDR]);
    expect(map.get(ADDR)).toBeNull();

    allSettledSpy.mockRestore();
  });
});

// ── getTopPayers / getTopFreelancers / getTopLPs — alias/default chains ────────

describe('soroban – getTopPayers alias/default fallbacks', () => {
  it('falls back through address/payer/account and paid/defaulted/volume aliases', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });

    const entries = [
      // path1 for each field: second alias used
      { payer: 'PPAYER1', paid: 7, defaults: 2, volume_paid: 1000n },
      // path2 for each field: all aliases missing, literal defaults used
      { account: 'AACCOUNT2' },
      // path3 for address chain only: everything missing -> ''
      {},
    ];
    (scValToNative as any).mockReturnValue(entries);

    const payers = await getTopPayers(10);
    expect(payers).toHaveLength(3);
    expect(payers[0]).toMatchObject({
      address: 'PPAYER1',
      score: 0,
      invoices_paid: 7,
      invoices_defaulted: 2,
      total_volume: 1000n,
    });
    expect(payers[1]).toMatchObject({
      address: 'AACCOUNT2',
      invoices_paid: 0,
      invoices_defaulted: 0,
      total_volume: 0n,
    });
    expect(payers[2].address).toBe('');
  });
});

describe('soroban – getTopFreelancers alias/default fallbacks', () => {
  it('falls back through address/freelancer/account and submitted/funded/earned aliases', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });

    const entries = [
      { freelancer: 'FFREELANCER1', submitted: 4, funded: 3, earned: 900n },
      { account: 'AACCOUNT2' },
      {},
    ];
    (scValToNative as any).mockReturnValue(entries);

    const freelancers = await getTopFreelancers(10);
    expect(freelancers).toHaveLength(3);
    expect(freelancers[0]).toMatchObject({
      address: 'FFREELANCER1',
      score: 0,
      invoices_submitted: 4,
      invoices_funded: 3,
      total_earned: 900n,
    });
    expect(freelancers[1]).toMatchObject({
      address: 'AACCOUNT2',
      invoices_submitted: 0,
      invoices_funded: 0,
      total_earned: 0n,
    });
    expect(freelancers[2].address).toBe('');
  });
});

describe('soroban – getTopLPs alias/default fallbacks', () => {
  it('falls back through address/lp/account and liquidity/fees/funded aliases', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });

    const entries = [
      { lp: 'LLP1', liquidity: 500n, fees: 10n, funded_count: 6 },
      { account: 'AACCOUNT2' },
      {},
    ];
    (scValToNative as any).mockReturnValue(entries);

    const lps = await getTopLPs(10);
    expect(lps).toHaveLength(3);
    expect(lps[0]).toMatchObject({
      address: 'LLP1',
      liquidity_provided: 500n,
      fees_earned: 10n,
      total_funded: 6,
      score: 0,
    });
    expect(lps[1]).toMatchObject({
      address: 'AACCOUNT2',
      liquidity_provided: 0n,
      fees_earned: 0n,
      total_funded: 0,
    });
    expect(lps[2].address).toBe('');
  });
});

// ── getReferralStats — default-value chain ──────────────────────────────────────

describe('soroban – getReferralStats default fallbacks', () => {
  it('defaults total_invoices and total_volume to 0 when both are missing from native', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });
    (scValToNative as any).mockReturnValue({});
    const stats = await getReferralStats('CODE');
    expect(stats.total_invoices).toBe(0);
    expect(stats.total_volume).toBe(0n);
  });
});

// ── submitInvoicesBatch — non-Error throw branch ────────────────────────────────

describe('soroban – submitInvoicesBatch non-Error throw', () => {
  it("uses 'Unknown error' when the caught value is not an Error instance", async () => {
    setupSuccess(42n);
    (rpc.Api as any).GetTransactionStatus = { SUCCESS: 'SUCCESS' };

    const { parseAmountToUnits } = await import('@/utils/invoiceSubmission');
    (parseAmountToUnits as any).mockImplementationOnce(() => {
      throw 'not an Error object';
    });

    const results = await submitInvoicesBatch(
      ADDR,
      [{ payer: ADDR, amount: '100', dueDate: '2026-01-01', discountRate: '5', tokenId: USDC }],
      async () => 'signedXDR'
    );
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBe('Unknown error');
  });
});

// ── buildApproveTokenTransaction — simulation error without 'error' key ────────

describe('soroban – buildApproveTokenTransaction default error message', () => {
  it("uses the default message when the failed simulation result has no 'error' key", async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({});
    await expect(buildApproveTokenTransaction({ owner: ADDR, amount: 1000n })).rejects.toThrow(
      'Unable to simulate token approval.'
    );
  });
});

// ── getInsurancePoolInfo — default-value chain ──────────────────────────────────

describe('soroban – getInsurancePoolInfo default fallbacks', () => {
  it('defaults balance/enrolled_count/premium_rate to 0 when all are missing from native', async () => {
    setupSuccess();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } });
    (scValToNative as any).mockReturnValue({});
    const info = await getInsurancePoolInfo();
    expect(info).toMatchObject({ balance: 0n, enrolled_count: 0, premium_rate: 0 });
  });
});
