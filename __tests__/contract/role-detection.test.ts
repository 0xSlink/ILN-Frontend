/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockServer } = vi.hoisted(() => {
  const mockServer: any = {
    getHealth: vi.fn(() => Promise.resolve({ status: 'healthy' })),
    simulateTransaction: vi.fn(),
  };
  return { mockServer };
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
        isSimulationSuccess: vi.fn((res: any) => Boolean(res?.result?.retval !== undefined)),
      },
    },
    scValToNative: vi.fn((val: any) => val),
    nativeToScVal: vi.fn((val: any) => val),
    Address: {
      fromString: vi.fn(() => ({
        toScVal: vi.fn(() => ({})),
      })),
    },
    TransactionBuilder: vi.fn(function (this: any) {
      this.addOperation = vi.fn().mockReturnThis();
      this.setTimeout = vi.fn().mockReturnThis();
      this.build = vi.fn(() => ({}));
    }),
    Operation: {
      invokeContractFunction: vi.fn(() => ({})),
    },
    Account: vi.fn(function (this: any, address: string) {
      this.accountId = () => address;
    }),
    BASE_FEE: '100',
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

import {
  getWalletRoles,
  listInvoicesBySubmitter,
  listInvoicesByPayer,
  listInvoicesByLp,
} from '@/utils/soroban';

describe('Wallet Role Detection Integration Tests', () => {
  const TEST_ADDR = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects freelancer role when list_invoices_by_submitter returns invoices', async () => {
    mockServer.simulateTransaction.mockImplementation(async () => {
      return {
        result: {
          retval: [
            {
              id: 1n,
              freelancer: TEST_ADDR,
              payer: 'GPAYER123',
              amount: 1000n,
              due_date: 1700000000n,
              discount_rate: 200,
              status: { Pending: {} },
            },
          ],
        },
      };
    });

    const submitterInvoices = await listInvoicesBySubmitter(TEST_ADDR);
    const payerInvoices = await listInvoicesByPayer(TEST_ADDR);
    const lpInvoices = await listInvoicesByLp(TEST_ADDR);
    expect(submitterInvoices.length).toBe(1);
    expect(payerInvoices.length).toBe(1);
    expect(lpInvoices.length).toBe(1);

    const roles = await getWalletRoles(TEST_ADDR);
    expect(roles).toContain('freelancer');
  });

  it('detects multiple roles (freelancer, payer, lp) when all view functions return invoices', async () => {
    mockServer.simulateTransaction.mockImplementation(async () => {
      return {
        result: {
          retval: [
            {
              id: 101n,
              freelancer: TEST_ADDR,
              payer: TEST_ADDR,
              funder: TEST_ADDR,
              amount: 5000n,
              due_date: 1700000000n,
              discount_rate: 150,
              status: { Funded: {} },
            },
          ],
        },
      };
    });

    const roles = await getWalletRoles(TEST_ADDR);
    expect(roles).toContain('freelancer');
    expect(roles).toContain('payer');
    expect(roles).toContain('lp');
  });

  it('returns empty roles array when user has no invoices across views', async () => {
    mockServer.simulateTransaction.mockImplementation(async () => {
      return {
        result: {
          retval: [],
        },
      };
    });

    const roles = await getWalletRoles('GUSERWITHNOINVOICES');
    expect(roles).toEqual([]);
  });

  it('falls back gracefully to table scan if dedicated contract view functions fail', async () => {
    let callCount = 0;
    mockServer.simulateTransaction.mockImplementation(async () => {
      callCount++;
      if (callCount <= 4) {
        return { result: null };
      }
      return {
        result: {
          retval: {
            id: 1n,
            freelancer: TEST_ADDR,
            payer: 'GPAYER',
            amount: 100n,
            due_date: 1700000000n,
            discount_rate: 100,
            status: 'Pending',
          },
        },
      };
    });

    const roles = await getWalletRoles(TEST_ADDR);
    expect(roles).toContain('freelancer');
  });
});
