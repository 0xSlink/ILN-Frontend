import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProtocolCaps, fetchProtocolCaps } from '../useProtocolCaps';
import { capKeys } from '../keys';

const useQueryMock = vi.fn((config: any) => ({ data: undefined, __config: config }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: any) => useQueryMock(config),
}));

const { getMaxInvoiceAmountMock, getTokenVolumeCapMock } = vi.hoisted(() => ({
  getMaxInvoiceAmountMock: vi.fn(),
  getTokenVolumeCapMock: vi.fn(),
}));

vi.mock('@/utils/soroban', () => ({
  getMaxInvoiceAmount: getMaxInvoiceAmountMock,
  getTokenVolumeCap: getTokenVolumeCapMock,
}));

describe('useProtocolCaps', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
    getMaxInvoiceAmountMock.mockReset();
    getTokenVolumeCapMock.mockReset();
  });

  it('queries with the capKeys summary key and fetches caps', () => {
    renderHook(() => useProtocolCaps({ tokenId: 'TOKEN_123' }));
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual(capKeys.summary('TOKEN_123'));
    expect(typeof config.queryFn).toBe('function');
  });

  it('transforms raw cap units into formatted representations via select', () => {
    renderHook(() =>
      useProtocolCaps({
        tokenId: 'TOKEN_123',
        tokenSymbol: 'USDC',
        tokenDecimals: 6,
      })
    );
    const { select } = useQueryMock.mock.calls[0][0];

    const result = select({
      maxInvoiceAmount: 5_000_000_000n, // 5,000 USDC
      tokenVolumeCap: 50_000_000_000n, // 50,000 USDC
    });

    expect(result.hasMaxInvoiceCap).toBe(true);
    expect(result.hasVolumeCap).toBe(true);
    expect(result.isRolloutCapped).toBe(true);
    expect(result.formattedMaxInvoiceAmount).toBe('5,000 USDC');
    expect(result.formattedTokenVolumeCap).toBe('50,000 USDC');
  });

  it('returns null formatted strings and false flags when caps are 0 (uncapped)', () => {
    renderHook(() => useProtocolCaps());
    const { select } = useQueryMock.mock.calls[0][0];

    const result = select({
      maxInvoiceAmount: 0n,
      tokenVolumeCap: 0n,
    });

    expect(result.hasMaxInvoiceCap).toBe(false);
    expect(result.hasVolumeCap).toBe(false);
    expect(result.isRolloutCapped).toBe(false);
    expect(result.formattedMaxInvoiceAmount).toBeNull();
    expect(result.formattedTokenVolumeCap).toBeNull();
  });

  describe('fetchProtocolCaps', () => {
    it('calls getMaxInvoiceAmount and getTokenVolumeCap when tokenId is supplied', async () => {
      getMaxInvoiceAmountMock.mockResolvedValue(10_000n);
      getTokenVolumeCapMock.mockResolvedValue(100_000n);

      const caps = await fetchProtocolCaps('TOKEN_ABC');
      expect(getMaxInvoiceAmountMock).toHaveBeenCalled();
      expect(getTokenVolumeCapMock).toHaveBeenCalledWith('TOKEN_ABC');
      expect(caps).toEqual({
        maxInvoiceAmount: 10_000n,
        tokenVolumeCap: 100_000n,
      });
    });

    it('returns 0n for volume cap when no tokenId is supplied', async () => {
      getMaxInvoiceAmountMock.mockResolvedValue(20_000n);

      const caps = await fetchProtocolCaps();
      expect(getMaxInvoiceAmountMock).toHaveBeenCalled();
      expect(getTokenVolumeCapMock).not.toHaveBeenCalled();
      expect(caps).toEqual({
        maxInvoiceAmount: 20_000n,
        tokenVolumeCap: 0n,
      });
    });
  });
});
