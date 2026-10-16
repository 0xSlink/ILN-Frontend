/**
 * Transaction-encoding financial-correctness tests (Issue #760).
 *
 * Proves the core invariant of the transaction-preview feature: the amount a
 * user enters/displays in the UI — parsed at the selected token's contract
 * decimals — is exactly the raw value encoded into the signed Soroban payload.
 *
 * Uses the same mocked `@stellar/stellar-sdk` transport as the contract
 * integration suite (`__tests__/contract/soroban.test.ts`); the mock captures
 * the `nativeToScVal` calls, which is precisely where the payload amounts are
 * serialized.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockServer, mockTx, mockAssembledTx, encodedValues } = vi.hoisted(() => {
  const encodedValues: Array<{ value: unknown; type?: string }> = [];
  const mockTx: any = {
    toEnvelope: vi.fn(() => ({ toXDR: () => 'xdr' })),
    toXDR: vi.fn(() => 'txXDR'),
  };
  const mockAssembledTx: any = { build: vi.fn(() => mockTx) };
  const mockServer: any = {
    getHealth: vi.fn(() => Promise.resolve({ status: 'healthy' })),
    simulateTransaction: vi.fn(() => Promise.resolve({ result: { retval: { ok: 1 } } } as any)),
    getAccount: vi.fn(() =>
      Promise.resolve({
        accountId: () => 'GAAA',
        incrementSequenceNumber: vi.fn(),
        sequenceNumber: () => '100',
      } as any)
    ),
    sendTransaction: vi.fn(() => Promise.resolve({ status: 'PENDING', hash: 'txhash123' })),
    getTransaction: vi.fn(() => Promise.resolve({ status: 'SUCCESS' })),
  };
  return { mockServer, mockTx, mockAssembledTx, encodedValues };
});

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
      },
      assembleTransaction: vi.fn(() => mockAssembledTx),
    },
    scValToNative: vi.fn((val: any) => val),
    nativeToScVal: vi.fn((value: unknown, opts?: { type?: string }) => {
      encodedValues.push({ value, type: opts?.type });
      return { _arm: 'mock' };
    }),
    Address: {
      fromString: vi.fn((_addr: string) => ({
        toScVal: vi.fn(() => ({ _arm: 'address' })),
        toScAddress: vi.fn(() => ({})),
      })),
    },
    TransactionBuilder: vi.fn(function (this: any) {
      this.addOperation = vi.fn().mockReturnThis();
      this.setTimeout = vi.fn().mockReturnThis();
      this.build = vi.fn(() => mockTx);
    }),
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

import { fundInvoice, markPaid, submitInvoice } from '@/utils/soroban';
import { scValToNative } from '@stellar/stellar-sdk';
import { parseAmountToUnits } from '@/utils/invoiceSubmission';

const FREELANCER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const PAYER = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBVN';
const FUNDER = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6B';

function lastEncodedByType(type: string): unknown {
  for (let i = encodedValues.length - 1; i >= 0; i -= 1) {
    if (encodedValues[i].type === type) return encodedValues[i].value;
  }
  return undefined;
}

beforeEach(() => {
  encodedValues.length = 0;
  vi.clearAllMocks();
  (mockServer.simulateTransaction as any).mockResolvedValue({
    result: { retval: { ok: 1 } },
  } as any);
  (mockServer.getAccount as any).mockResolvedValue({
    accountId: () => 'GAAA',
    incrementSequenceNumber: vi.fn(),
    sequenceNumber: () => '100',
  } as any);
});

describe('financial correctness: markPaid encodes exactly the UI amount', () => {
  it.each([
    { symbol: 'USDC', decimals: 6, human: '125.5' },
    { symbol: 'EURC', decimals: 7, human: '125.5' },
    { symbol: 'XLM', decimals: 7, human: '125.5000001' },
  ])(
    '$symbol — the $human amount the payer sees is the i128 encoded on-chain',
    async ({ decimals, human }) => {
      const units = parseAmountToUnits(human, decimals)!;
      expect(units).not.toBeNull();

      await markPaid(PAYER, BigInt(1), units);

      // The i128 amount in the payload is byte-for-byte the UI-parsed units.
      expect(lastEncodedByType('i128')).toStrictEqual(units);
    }
  );

  it('signs the exact units for a full-precision entry (no silent truncation)', async () => {
    const units = parseAmountToUnits('1000.1234567', 7)!;
    await markPaid(PAYER, BigInt(2), units);
    expect(lastEncodedByType('i128')).toStrictEqual(1_000_1234567n);
  });
});

describe('financial correctness: submitInvoice encodes amount, due date, and discount', () => {
  it('encodes the parsed amount as i128 exactly as the UI computed it', async () => {
    const amountUnits = parseAmountToUnits('250.75', 7)!;
    await submitInvoice({
      freelancer: FREELANCER,
      payer: PAYER,
      amount: amountUnits,
      dueDate: 1893456000,
      discountRate: 500,
    });
    expect(lastEncodedByType('i128')).toStrictEqual(amountUnits);
  });

  it('encodes the discount-rate bps the preview displayed', async () => {
    await submitInvoice({
      freelancer: FREELANCER,
      payer: PAYER,
      amount: 1_000_000n,
      dueDate: 1893456000,
      discountRate: 500, // 5% — what the preview shows as "5%"
    });
    expect(lastEncodedByType('u32')).toStrictEqual(500);
  });
});

describe('financial correctness: fundInvoice encodes the required funding amount', () => {
  it('encodes the funding amount the LP preview displays', async () => {
    // The contract returns an invoice whose amount the LP preview shows;
    // fund_invoice must encode exactly that amount as i128.
    (scValToNative as any).mockReturnValue({
      id: BigInt(3),
      freelancer: FREELANCER,
      payer: PAYER,
      amount: BigInt(250_000_000),
      due_date: BigInt(1896048000),
      discount_rate: 320,
      status: 'Funded',
      funder: FUNDER,
      funded_at: undefined,
      token: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    });

    await fundInvoice(FUNDER, BigInt(3));

    expect(lastEncodedByType('i128')).toStrictEqual(250_000_000n);
  });
});
