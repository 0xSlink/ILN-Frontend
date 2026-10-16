/**
 * Contract integration tests for src/utils/soroban.ts
 * Mocks @stellar/stellar-sdk to avoid real blockchain dependency.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── vi.hoisted: creates mock objects before vi.mock hoisting runs ─────────────

const { mockServer, mockTx, mockAssembledTx } = vi.hoisted(() => {
  const mockTx: any = {
    toEnvelope: vi.fn(() => ({ toXDR: () => 'xdr' })),
    toXDR: vi.fn(() => 'txXDR'),
  };
  const mockAssembledTx: any = { build: vi.fn(() => mockTx) };
  const mockServer: any = {
    getHealth: vi.fn(() => Promise.resolve({ status: 'healthy' })),
    simulateTransaction: vi.fn(() => Promise.resolve({ result: { retval: {} } } as any)),
    getAccount: vi.fn(() =>
      Promise.resolve({
        accountId: () => 'GAAA',
        incrementSequenceNumber: vi.fn(),
        sequenceNumber: () => '100',
      } as any)
    ),
    sendTransaction: vi.fn(() => Promise.resolve({ status: 'PENDING', hash: 'txhash123' })),
    getTransaction: vi.fn(() => Promise.resolve({ status: 'SUCCESS' })),
    prepareTransaction: vi.fn(() => Promise.resolve({ toXDR: vi.fn(() => 'preparedXDR') } as any)),
    pollTransaction: vi.fn(() => Promise.resolve({ status: 'SUCCESS' } as any)),
  };
  return { mockServer, mockTx, mockAssembledTx };
});

// ── Mock Stellar SDK ───────────────────────────────────────────────────────────

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();

  function MockRpcServer() {
    return mockServer;
  }

  return {
    ...actual,
    rpc: {
      Server: MockRpcServer,
      Api: {
        isSimulationSuccess: vi.fn((result: any) => !!result?.result),
        GetTransactionStatus: { SUCCESS: 'SUCCESS' },
      },
      assembleTransaction: vi.fn(() => mockAssembledTx),
    },
    scValToNative: vi.fn((val: any) => val),
    nativeToScVal: vi.fn((_val: any, _opts?: any) => ({ _arm: 'mock' })),
    Address: {
      fromString: vi.fn((_addr: string) => ({
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
    Account: vi.fn(function (this: any, address: string, _seq: string) {
      this.accountId = () => address;
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
  parseAmountToUnits: vi.fn((v: string) => BigInt(Math.floor(parseFloat(v) * 1_000_000))),
  parseDiscountRateToBps: vi.fn((v: number) => Math.round(v * 100)),
  toUnixTimestamp: vi.fn((d: string) => Math.floor(new Date(d).getTime() / 1000)),
}));

// ── Import AFTER mocks ─────────────────────────────────────────────────────────

import {
  getInvoice,
  getInvoiceCount,
  fundInvoice,
  markPaid,
  cancelInvoice,
  submitInvoice,
  getPayerScore,
  getTokenBalance,
  getTokenMetadata,
  getApprovedTokenIds,
  submitInvoiceTransaction,
  type SubmitInvoiceArgs,
} from '@/utils/soroban';

import { rpc, scValToNative, nativeToScVal, Address } from '@stellar/stellar-sdk';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FREELANCER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const PAYER = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBVN';
const FUNDER = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6B';
const USDC = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';

function makeInvoiceNative(overrides: Partial<any> = {}) {
  return {
    id: BigInt(1),
    status: { Pending: null },
    freelancer: FREELANCER,
    payer: PAYER,
    amount: BigInt(100_000_000),
    due_date: BigInt(1893456000),
    discount_rate: 250,
    funder: undefined,
    funded_at: undefined,
    token: USDC,
    ...overrides,
  };
}

const mockAccount = () =>
  ({
    accountId: () => FREELANCER,
    incrementSequenceNumber: vi.fn(),
    sequenceNumber: () => '1',
  }) as any;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('soroban – get_invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (scValToNative as any).mockReturnValue(makeInvoiceNative());
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } } as any);
  });

  it('returns a correctly shaped Invoice object', async () => {
    (scValToNative as any).mockReturnValue(makeInvoiceNative());
    const invoice = await getInvoice(BigInt(1));
    expect(invoice.freelancer).toBe(FREELANCER);
    expect(invoice.payer).toBe(PAYER);
    expect(invoice.amount).toBe(BigInt(100_000_000));
  });

  it('throws when simulation fails', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'Contract error' } as any);
    await expect(getInvoice(BigInt(99))).rejects.toThrow('Failed to get invoice 99');
  });

  it('calls simulateTransaction exactly once', async () => {
    (scValToNative as any).mockReturnValue(makeInvoiceNative());
    await getInvoice(BigInt(5));
    expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(1);
  });

  it('parses status from object key (Funded)', async () => {
    (scValToNative as any).mockReturnValue(makeInvoiceNative({ status: { Funded: null } }));
    const invoice = await getInvoice(BigInt(2));
    expect(invoice.status).toBe('Funded');
  });

  it('parses status from object key (Paid)', async () => {
    (scValToNative as any).mockReturnValue(makeInvoiceNative({ status: { Paid: null } }));
    const invoice = await getInvoice(BigInt(3));
    expect(invoice.status).toBe('Paid');
  });
});

describe('soroban – get_invoice_count', () => {
  it('returns invoice count as bigint from healthy RPC', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (scValToNative as any).mockReturnValue(BigInt(42));
    mockServer.getHealth.mockResolvedValue({ status: 'healthy' });
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } } as any);

    const count = await getInvoiceCount();
    expect(typeof count).toBe('bigint');
  });

  it('throws when RPC is unhealthy', async () => {
    mockServer.getHealth.mockResolvedValueOnce({ status: 'unhealthy' });
    await expect(getInvoiceCount()).rejects.toThrow('RPC server is not healthy');
  });
});

describe('soroban – submitInvoiceTransaction', () => {
  it('returns the invoice id from transaction returnValue metadata when available', async () => {
    const signTx = vi.fn(async () => 'signedXDR');
    const _returnValue = (await import('@stellar/stellar-sdk')).xdr.ScVal.scvU64(42n);

    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (scValToNative as any).mockReturnValue(42n);
    mockServer.getAccount.mockResolvedValue(mockAccount());
    mockServer.prepareTransaction.mockResolvedValue({ toXDR: vi.fn(() => 'preparedXDR') } as any);
    mockServer.sendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'sentHash123' } as any);
    mockServer.pollTransaction.mockResolvedValue({
      status: 'SUCCESS',
      result: { retval: {} },
    } as any);
    (rpc.Api.GetTransactionStatus as any) = { SUCCESS: 'SUCCESS' };

    const result = await submitInvoiceTransaction({
      freelancer: FREELANCER,
      payer: PAYER,
      amount: 100_000n,
      dueDate: 1735689600,
      discountRate: 250,
      signTx,
      token: USDC,
    });

    expect(result.invoiceId).toBe(42n);
    expect(result.txHash).toBe('sentHash123');
    expect(signTx).toHaveBeenCalledWith('preparedXDR');
  });
});

describe('soroban – fund_invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (rpc.assembleTransaction as any).mockReturnValue(mockAssembledTx);
    (scValToNative as any).mockReturnValue(makeInvoiceNative());
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } } as any);
    mockServer.getAccount.mockResolvedValue(mockAccount());
  });

  it('builds a fund_invoice transaction', async () => {
    const tx = await fundInvoice(FUNDER, BigInt(1));
    expect(tx).toBeDefined();
  });

  it('throws when fund_invoice simulation fails', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValueOnce(true).mockReturnValueOnce(false);
    mockServer.simulateTransaction
      .mockResolvedValueOnce({ result: { retval: {} } } as any)
      .mockResolvedValueOnce({ error: 'Insufficient balance' } as any);

    await expect(fundInvoice(FUNDER, BigInt(1))).rejects.toThrow('Simulation failed');
  });

  it('correctly encodes invoice_id as u64 param', async () => {
    (rpc.assembleTransaction as any).mockReturnValue(mockAssembledTx);
    await fundInvoice(FUNDER, BigInt(7));
    expect(nativeToScVal).toHaveBeenCalledWith(BigInt(7), { type: 'u64' });
  });
});

describe('soroban – mark_paid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (rpc.assembleTransaction as any).mockReturnValue(mockAssembledTx);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } } as any);
    mockServer.getAccount.mockResolvedValue(mockAccount());
  });

  it('builds a mark_paid transaction', async () => {
    const tx = await markPaid(PAYER, BigInt(1), BigInt(100_000_000));
    expect(tx).toBeDefined();
  });

  it('throws when mark_paid simulation fails', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'Not funded' } as any);
    await expect(markPaid(PAYER, BigInt(1), BigInt(100_000_000))).rejects.toThrow(
      'Simulation failed'
    );
  });

  it('encodes invoice_id as u64 and amount as i128', async () => {
    await markPaid(PAYER, BigInt(3), BigInt(250_000_000));
    expect(nativeToScVal).toHaveBeenCalledWith(BigInt(3), { type: 'u64' });
    expect(nativeToScVal).toHaveBeenCalledWith(BigInt(250_000_000), { type: 'i128' });
  });
});

describe('soroban – cancel_invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (rpc.assembleTransaction as any).mockReturnValue(mockAssembledTx);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } } as any);
    mockServer.getAccount.mockResolvedValue(mockAccount());
  });

  it('builds a cancel_invoice transaction', async () => {
    const result = await cancelInvoice(FREELANCER, BigInt(1));
    expect(result.tx).toBeDefined();
  });

  it('falls back to Account constructor when getAccount fails', async () => {
    mockServer.getAccount.mockRejectedValueOnce(new Error('Account not found'));
    const result = await cancelInvoice(FREELANCER, BigInt(2));
    expect(result.tx).toBeDefined();
  });

  it('throws when cancel simulation fails', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({
      error: 'Cannot cancel funded invoice',
    } as any);
    await expect(cancelInvoice(FREELANCER, BigInt(5))).rejects.toThrow('Simulation failed');
  });
});

describe('soroban – submit_invoice', () => {
  const validArgs: SubmitInvoiceArgs = {
    freelancer: FREELANCER,
    payer: PAYER,
    amount: BigInt(125_000_000),
    dueDate: 1893456000,
    discountRate: 250,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (rpc.assembleTransaction as any).mockReturnValue(mockAssembledTx);
    (scValToNative as any).mockReturnValue({ ok: BigInt(42) });
    mockServer.simulateTransaction.mockResolvedValue({
      result: { retval: { ok: BigInt(42) } },
    } as any);
    mockServer.getAccount.mockResolvedValue(mockAccount());
  });

  it('returns tx and invoiceId on success', async () => {
    const result = await submitInvoice(validArgs);
    expect(result.tx).toBeDefined();
    expect(typeof result.invoiceId).toBe('bigint');
  });

  it('throws when submit simulation fails', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'Rate limit exceeded' } as any);
    await expect(submitInvoice(validArgs)).rejects.toThrow('Simulation failed');
  });

  it('encodes freelancer and payer addresses as ScVal', async () => {
    await submitInvoice(validArgs);
    expect(Address.fromString).toHaveBeenCalledWith(FREELANCER);
    expect(Address.fromString).toHaveBeenCalledWith(PAYER);
  });

  it('extracts Ok-variant invoice ID', async () => {
    (scValToNative as any).mockReturnValue({ ok: BigInt(99) });
    mockServer.simulateTransaction.mockResolvedValue({
      result: { retval: { ok: BigInt(99) } },
    } as any);
    const result = await submitInvoice(validArgs);
    expect(result.invoiceId).toBe(BigInt(99));
  });

  it('extracts Ok-variant (capital) invoice ID', async () => {
    (scValToNative as any).mockReturnValue({ Ok: BigInt(88) });
    mockServer.simulateTransaction.mockResolvedValue({
      result: { retval: { Ok: BigInt(88) } },
    } as any);
    const result = await submitInvoice(validArgs);
    expect(result.invoiceId).toBe(BigInt(88));
  });

  it('falls back to invoiceId=0 when retval parse throws', async () => {
    (scValToNative as any).mockImplementation(() => {
      throw new Error('parse error');
    });
    const result = await submitInvoice(validArgs);
    expect(result.invoiceId).toBe(BigInt(0));
  });
});

describe('soroban – get_payer_score', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns PayerScoreResult on success', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (scValToNative as any).mockReturnValue({ score: 85, settled_on_time: 10, defaults: 1 });
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } } as any);

    const score = await getPayerScore(PAYER);
    expect(score).toMatchObject({ score: 85, settled_on_time: 10, defaults: 1 });
  });

  it('returns null when simulation fails', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'Not found' } as any);
    const score = await getPayerScore(PAYER);
    expect(score).toBeNull();
  });

  it('returns null when retval is null', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (scValToNative as any).mockReturnValue(null);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: null } } as any);
    const score = await getPayerScore(PAYER);
    expect(score).toBeNull();
  });
});

describe('soroban – get_token_balance', () => {
  it('returns balance as bigint', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (scValToNative as any).mockReturnValue(BigInt(1_000_000_000));
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } } as any);
    const balance = await getTokenBalance(FREELANCER, USDC);
    expect(typeof balance).toBe('bigint');
  });

  it('throws when balance fetch fails', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' } as any);
    await expect(getTokenBalance(FREELANCER, USDC)).rejects.toThrow(
      'Failed to fetch token balance'
    );
  });
});

describe('soroban – get_token_metadata', () => {
  it('falls back to known metadata when RPC fails', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' } as any);
    const meta = await getTokenMetadata(USDC);
    expect(meta.symbol).toBe('USDC');
    expect(meta.contractId).toBe(USDC);
  });

  it('returns token metadata with valid decimals', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (scValToNative as any)
      .mockReturnValueOnce('USD Coin')
      .mockReturnValueOnce('USDC')
      .mockReturnValueOnce(6);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } } as any);
    const meta = await getTokenMetadata(USDC);
    expect(meta.contractId).toBe(USDC);
  });
});

describe('soroban – get_approved_token_ids', () => {
  it('returns array of token IDs on success', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (scValToNative as any).mockReturnValue([USDC]);
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } } as any);
    const tokens = await getApprovedTokenIds();
    expect(Array.isArray(tokens)).toBe(true);
  });

  it('throws when token list fetch fails', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' } as any);
    await expect(getApprovedTokenIds()).rejects.toThrow('Failed to fetch approved tokens');
  });
});

describe('soroban – XDR encoding validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(true);
    (scValToNative as any).mockReturnValue(makeInvoiceNative());
    mockServer.simulateTransaction.mockResolvedValue({ result: { retval: {} } } as any);
  });

  it('nativeToScVal is called with u64 for invoice IDs', async () => {
    await getInvoice(BigInt(1));
    expect(nativeToScVal).toHaveBeenCalledWith(BigInt(1), { type: 'u64' });
  });

  it('Address.fromString is used to encode wallet addresses', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({ error: 'fail' } as any);
    try {
      await getTokenBalance(FREELANCER, USDC);
    } catch {}
    expect(Address.fromString).toHaveBeenCalledWith(FREELANCER);
  });
});

describe('soroban – error mapping', () => {
  it('maps failed get_invoice simulation to descriptive error', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({
      error: 'HostError: Error(Contract, #4)',
    } as any);
    await expect(getInvoice(BigInt(4))).rejects.toThrow('Failed to get invoice 4');
  });

  it('maps failed fund_invoice to Simulation failed error', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValueOnce(true).mockReturnValueOnce(false);
    (scValToNative as any).mockReturnValue(makeInvoiceNative());
    mockServer.simulateTransaction
      .mockResolvedValueOnce({ result: { retval: {} } } as any)
      .mockResolvedValueOnce({ error: 'Contract error' } as any);
    mockServer.getAccount.mockResolvedValue(mockAccount());
    await expect(fundInvoice(FUNDER, BigInt(1))).rejects.toThrow('Simulation failed');
  });

  it('maps failed mark_paid simulation to thrown error', async () => {
    (rpc.Api.isSimulationSuccess as any).mockReturnValue(false);
    mockServer.simulateTransaction.mockResolvedValue({
      error: 'HostError: Error(Contract, #7)',
    } as any);
    mockServer.getAccount.mockResolvedValue(mockAccount());
    await expect(markPaid(PAYER, BigInt(1), BigInt(100n))).rejects.toThrow('Simulation failed');
  });
});
