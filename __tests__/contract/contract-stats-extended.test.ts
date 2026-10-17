/**
 * Extended contract-stats tests for uncovered branches:
 * - XLM token path in getTokenInfo (line 59-63)
 * - Unknown token fallback (line 63)
 * - else bucket.usdc fallback in buildHistoricalVolume (line 97-98)
 * - PartiallyFunded status counting
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildHistoricalVolume, get_contract_stats } from '@/utils/contract-stats';
import type { Invoice } from '@/utils/soroban';

vi.mock('@/constants', () => ({
  CONTRACT_ID: 'CTEST',
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  RPC_URL: 'https://soroban-testnet.stellar.org',
  TESTNET_USDC_TOKEN_ID: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  TESTNET_EURC_TOKEN_ID: 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV',
  TESTNET_XLM_TOKEN_ID: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
}));

vi.mock('@/utils/soroban', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/soroban')>();
  return { ...actual, getAllInvoices: vi.fn() };
});

vi.mock('@/lib/fetch-protocol-contract-events', () => ({
  fetchProtocolContractEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/utils/governance', () => ({
  fetchProtocolParameters: vi.fn().mockResolvedValue({
    feeRateBps: 50,
    maxDiscountRateBps: 500,
    acceptedTokens: [],
    minProposalILN: 500,
  }),
}));

import { getAllInvoices } from '@/utils/soroban';
import { fetchProtocolParameters } from '@/utils/governance';

const XLM = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const USDC = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
const recentTs = BigInt(Math.floor(Date.now() / 1000) - 86400);

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1n,
    status: 'Pending',
    freelancer: 'G1',
    payer: 'G2',
    amount: 100_000_000n,
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
    discount_rate: 250,
    token: USDC,
    ...overrides,
  };
}

describe('contract-stats – XLM token path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calculates volume for XLM invoices', async () => {
    vi.mocked(getAllInvoices).mockResolvedValue([
      makeInvoice({
        id: 1n,
        status: 'Funded',
        token: XLM,
        amount: 10_000_000n,
        funded_at: recentTs,
      }),
    ]);
    const stats = await get_contract_stats();
    // 10_000_000 / 10^7 * 0.12 = 0.12
    expect(stats.total_volume_usd).toBeCloseTo(0.12, 1);
    const xlm = stats.volume_by_token.find((v) => v.symbol === 'XLM');
    expect(xlm!.amount_raw).toBeGreaterThan(0);
  });

  it('handles PartiallyFunded status as funded', async () => {
    vi.mocked(getAllInvoices).mockResolvedValue([
      makeInvoice({ id: 1n, status: 'PartiallyFunded', amount: 50_000_000n, funded_at: recentTs }),
    ]);
    const stats = await get_contract_stats();
    expect(stats.total_funded).toBe(1);
  });

  it('handles undefined token (defaults to USDC)', async () => {
    vi.mocked(getAllInvoices).mockResolvedValue([
      makeInvoice({
        id: 1n,
        status: 'Funded',
        token: undefined,
        amount: 100_000_000n,
        funded_at: recentTs,
      }),
    ]);
    const stats = await get_contract_stats();
    expect(stats.total_funded).toBe(1);
    const usdc = stats.volume_by_token.find((v) => v.symbol === 'USDC');
    expect(usdc!.amount_raw).toBeGreaterThan(0);
  });

  it('handles unknown token falling back to USDC symbol', async () => {
    vi.mocked(getAllInvoices).mockResolvedValue([
      makeInvoice({
        id: 1n,
        status: 'Funded',
        token: 'CUNKNOWNTOKEN',
        amount: 100_000_000n,
        funded_at: recentTs,
      }),
    ]);
    const stats = await get_contract_stats();
    expect(stats.total_funded).toBe(1);
  });
});

describe('buildHistoricalVolume – XLM and unknown token paths', () => {
  it('accumulates XLM volume into xlm bucket', () => {
    const invoices = [
      makeInvoice({ status: 'Funded', token: XLM, amount: 10_000_000n, funded_at: recentTs }),
    ];
    const buckets = buildHistoricalVolume(invoices, 7);
    const totalXlm = buckets.reduce((acc, b) => acc + b.xlm, 0);
    expect(totalXlm).toBeGreaterThan(0);
  });

  it('accumulates EURC volume into eurc bucket', () => {
    const EURC = 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV';
    const invoices = [
      makeInvoice({ status: 'Paid', token: EURC, amount: 10_000_000n, funded_at: recentTs }),
    ];
    const buckets = buildHistoricalVolume(invoices, 7);
    const totalEurc = buckets.reduce((acc, b) => acc + b.eurc, 0);
    expect(totalEurc).toBeGreaterThan(0);
  });

  it('accumulates unknown token into usdc bucket as fallback', () => {
    const invoices = [
      makeInvoice({
        status: 'Funded',
        token: 'CUNKNOWNTOKEN',
        amount: 10_000_000n,
        funded_at: recentTs,
      }),
    ];
    const buckets = buildHistoricalVolume(invoices, 7);
    const totalUsdc = buckets.reduce((acc, b) => acc + b.usdc, 0);
    expect(totalUsdc).toBeGreaterThan(0);
  });

  it('skips invoices without funded_at', () => {
    const invoices = [makeInvoice({ status: 'Funded', funded_at: undefined })];
    const buckets = buildHistoricalVolume(invoices, 7);
    const total = buckets.reduce((acc, b) => acc + b.volume_usd, 0);
    expect(total).toBe(0);
  });

  it('drops an invoice whose funded_at lands exactly on the cutoff boundary (no matching pre-seeded bucket)', () => {
    // The bucket map is pre-seeded for `days` calendar days counting back from
    // "now" (inclusive), i.e. the earliest bucket is `now - (days-1)` days.
    // `cutoff` itself is `now - days` days, one day earlier than that earliest
    // bucket. An invoice funded exactly at `cutoff` passes the `ts < cutoff`
    // filter (it's not less than cutoff) but its date has no pre-seeded
    // bucket, exercising the `if (!bucket) continue;` branch.
    const fixedNow = new Date('2026-01-08T00:00:00.000Z').getTime();
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    try {
      const days = 7;
      const cutoffSeconds = Math.floor((fixedNow - days * 24 * 60 * 60 * 1000) / 1000);
      const invoices: Invoice[] = [
        makeInvoice({
          status: 'Funded',
          amount: 1_000_000n,
          token: USDC,
          funded_at: BigInt(cutoffSeconds),
        }),
      ];
      const buckets = buildHistoricalVolume(invoices, days);
      const totalVolume = buckets.reduce((acc, b) => acc + b.volume_usd, 0);
      expect(totalVolume).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('get_contract_stats – fetchProtocolParameters failure fallback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('falls back to feeRateBps 0 when fetchProtocolParameters rejects', async () => {
    vi.mocked(getAllInvoices).mockResolvedValue([
      makeInvoice({
        id: 1n,
        status: 'Funded',
        amount: 100_000_000n,
        discount_rate: 250,
        funded_at: recentTs,
      }),
    ]);
    vi.mocked(fetchProtocolParameters).mockRejectedValueOnce(new Error('governance RPC down'));

    const stats = await get_contract_stats();

    // The .catch(() => ({ feeRateBps: 0 })) fallback kicks in, so feeBps is 0
    // and no protocol fees should be accrued for this invoice.
    expect(stats.feeRateBps).toBe(0);
    expect(stats.total_protocol_fees_usd).toBe(0);
    expect(stats.total_funded).toBe(1);
  });

  it('falls back to feeBps 0 when fetchProtocolParameters resolves without a feeRateBps field', async () => {
    vi.mocked(getAllInvoices).mockResolvedValue([
      makeInvoice({
        id: 1n,
        status: 'Funded',
        amount: 100_000_000n,
        discount_rate: 250,
        funded_at: recentTs,
      }),
    ]);
    // Resolves successfully (so .catch is not triggered) but with a shape
    // missing feeRateBps, exercising the `protocolParams.feeRateBps ?? 0`
    // nullish-coalescing fallback rather than the promise-rejection path.
    vi.mocked(fetchProtocolParameters).mockResolvedValueOnce({
      maxDiscountRateBps: 500,
      acceptedTokens: [],
      minProposalILN: 500,
    } as any);

    const stats = await get_contract_stats();

    expect(stats.feeRateBps).toBe(0);
    expect(stats.total_protocol_fees_usd).toBe(0);
  });
});
