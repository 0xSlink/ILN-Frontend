import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApprovedTokens } from '../useApprovedTokens';
import { TESTNET_USDC_TOKEN_ID, TESTNET_EURC_TOKEN_ID, TESTNET_XLM_TOKEN_ID } from '@/constants';

const getApprovedTokenIdsMock = vi.fn();
const getTokenMetadataMock = vi.fn();
const adminApproveTokenMock = vi.fn();
const adminRemoveTokenMock = vi.fn();

vi.mock('@/utils/soroban', () => ({
  getApprovedTokenIds: (...args: unknown[]) => getApprovedTokenIdsMock(...args),
  getTokenMetadata: (...args: unknown[]) => getTokenMetadataMock(...args),
  adminApproveToken: (...args: unknown[]) => adminApproveTokenMock(...args),
  adminRemoveToken: (...args: unknown[]) => adminRemoveTokenMock(...args),
}));

const usdcMeta = {
  contractId: TESTNET_USDC_TOKEN_ID,
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 7,
};
const eurcMeta = {
  contractId: TESTNET_EURC_TOKEN_ID,
  name: 'Euro Coin',
  symbol: 'EURC',
  decimals: 7,
};

describe('useApprovedTokens', () => {
  beforeEach(() => {
    getApprovedTokenIdsMock.mockReset();
    getTokenMetadataMock.mockReset();
    adminApproveTokenMock.mockReset();
    adminRemoveTokenMock.mockReset();
  });

  it('starts in a loading state', () => {
    getApprovedTokenIdsMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useApprovedTokens());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.tokens).toEqual([]);
  });

  it('loads approved tokens, merging fetched metadata over the known-token fallbacks', async () => {
    getApprovedTokenIdsMock.mockResolvedValue([usdcMeta.contractId, eurcMeta.contractId]);
    getTokenMetadataMock.mockImplementation(async (id: string) =>
      id === usdcMeta.contractId ? usdcMeta : eurcMeta
    );

    const { result } = renderHook(() => useApprovedTokens());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    // USDC, EURC, XLM (XLM comes from the KNOWN_TOKENS fallback, not approved).
    expect(result.current.tokens).toHaveLength(3);
    const usdc = result.current.tokenMap.get(usdcMeta.contractId);
    expect(usdc?.isAllowed).toBe(true);
    expect(usdc?.iconLabel).toBe('US');
    expect(usdc?.logo).toBe('/tokens/usdc.svg');

    const xlm = result.current.tokenMap.get(TESTNET_XLM_TOKEN_ID);
    expect(xlm?.isAllowed).toBe(false);
    expect(xlm?.unavailableReason).toBe('This token is not currently approved for ILN invoices.');
  });

  it('defaults to USDC when it is allowed', async () => {
    getApprovedTokenIdsMock.mockResolvedValue([usdcMeta.contractId]);
    getTokenMetadataMock.mockResolvedValue(usdcMeta);

    const { result } = renderHook(() => useApprovedTokens());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.defaultToken?.contractId).toBe(usdcMeta.contractId);
  });

  it('falls back to the first allowed token when USDC is not allowed', async () => {
    getApprovedTokenIdsMock.mockResolvedValue([eurcMeta.contractId]);
    getTokenMetadataMock.mockResolvedValue(eurcMeta);

    const { result } = renderHook(() => useApprovedTokens());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.defaultToken?.contractId).toBe(eurcMeta.contractId);
  });

  it('falls back to the (unallowed) USDC entry when nothing is allowed', async () => {
    getApprovedTokenIdsMock.mockResolvedValue([]);
    getTokenMetadataMock.mockResolvedValue(usdcMeta);

    const { result } = renderHook(() => useApprovedTokens());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.defaultToken?.contractId).toBe(usdcMeta.contractId);
    expect(result.current.defaultToken?.isAllowed).toBe(false);
  });

  it('sets an error and clears tokens when loading fails', async () => {
    getApprovedTokenIdsMock.mockRejectedValue(new Error('RPC unreachable'));

    const { result } = renderHook(() => useApprovedTokens());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('RPC unreachable');
    expect(result.current.tokens).toEqual([]);
  });

  it('falls back to a generic error message for non-Error rejections', async () => {
    getApprovedTokenIdsMock.mockRejectedValue('boom');

    const { result } = renderHook(() => useApprovedTokens());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Failed to load approved tokens.');
  });

  it('validates Stellar G/C addresses', async () => {
    getApprovedTokenIdsMock.mockResolvedValue([]);
    getTokenMetadataMock.mockResolvedValue(usdcMeta);
    const { result } = renderHook(() => useApprovedTokens());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.validateTokenAddress('G' + 'A'.repeat(55))).toBe(true);
    expect(result.current.validateTokenAddress('C' + 'A'.repeat(55))).toBe(true);
    expect(result.current.validateTokenAddress('not-an-address')).toBe(false);
  });

  it('rejects approveToken with an invalid address without calling the contract', async () => {
    getApprovedTokenIdsMock.mockResolvedValue([]);
    getTokenMetadataMock.mockResolvedValue(usdcMeta);
    const { result } = renderHook(() => useApprovedTokens());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.approveToken('GADMIN', 'not-valid', vi.fn())).rejects.toThrow(
      'Invalid token contract address.'
    );
    expect(adminApproveTokenMock).not.toHaveBeenCalled();
  });

  it('approves a token by building, signing, and returning the transaction', async () => {
    getApprovedTokenIdsMock.mockResolvedValue([]);
    getTokenMetadataMock.mockResolvedValue(usdcMeta);
    adminApproveTokenMock.mockResolvedValue({ toXDR: () => 'unsigned-xdr' });
    const signTx = vi.fn().mockResolvedValue('signed-xdr');

    const { result } = renderHook(() => useApprovedTokens());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const validAddress = 'C' + 'A'.repeat(55);
    const signed = await result.current.approveToken('GADMIN', validAddress, signTx);

    expect(adminApproveTokenMock).toHaveBeenCalledWith('GADMIN', validAddress);
    expect(signTx).toHaveBeenCalledWith('unsigned-xdr');
    expect(signed).toBe('signed-xdr');
  });

  it('removes a token by building, signing, and returning the transaction', async () => {
    getApprovedTokenIdsMock.mockResolvedValue([]);
    getTokenMetadataMock.mockResolvedValue(usdcMeta);
    adminRemoveTokenMock.mockResolvedValue({ toXDR: () => 'unsigned-remove-xdr' });
    const signTx = vi.fn().mockResolvedValue('signed-remove-xdr');

    const { result } = renderHook(() => useApprovedTokens());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const validAddress = 'G' + 'A'.repeat(55);
    const signed = await result.current.removeToken('GADMIN', validAddress, signTx);

    expect(adminRemoveTokenMock).toHaveBeenCalledWith('GADMIN', validAddress);
    expect(signTx).toHaveBeenCalledWith('unsigned-remove-xdr');
    expect(signed).toBe('signed-remove-xdr');
  });

  it('rejects removeToken with an invalid address without calling the contract', async () => {
    getApprovedTokenIdsMock.mockResolvedValue([]);
    getTokenMetadataMock.mockResolvedValue(usdcMeta);
    const { result } = renderHook(() => useApprovedTokens());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.removeToken('GADMIN', 'nope', vi.fn())).rejects.toThrow(
      'Invalid token contract address.'
    );
    expect(adminRemoveTokenMock).not.toHaveBeenCalled();
  });
});
