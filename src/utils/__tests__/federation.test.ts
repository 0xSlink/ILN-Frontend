import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveFederatedAddress, resolveStellarAddressFromName } from '../federation';

const dedupedFetchMock = vi.fn((_key: string, fn: () => Promise<unknown>) => fn());
const fetchHomeDomainMock = vi.fn();
vi.mock('@/lib/horizonClient', () => ({
  dedupedFetch: (...args: [string, () => Promise<unknown>, number]) => dedupedFetchMock(...args),
  fetchHomeDomain: (...args: unknown[]) => fetchHomeDomainMock(...args),
  TTL: { FEDERATION: 600_000 },
}));

const fetchMock = vi.fn();

describe('resolveFederatedAddress', () => {
  beforeEach(() => {
    dedupedFetchMock.mockClear();
    fetchHomeDomainMock.mockReset();
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('returns the input unchanged for an empty address', async () => {
    expect(await resolveFederatedAddress('')).toBe('');
    expect(fetchHomeDomainMock).not.toHaveBeenCalled();
  });

  it('returns the raw address when there is no home domain', async () => {
    fetchHomeDomainMock.mockResolvedValue(null);
    expect(await resolveFederatedAddress('GADDR')).toBe('GADDR');
  });

  it('returns the raw address when the stellar.toml fetch fails', async () => {
    fetchHomeDomainMock.mockResolvedValue('example.com');
    fetchMock.mockResolvedValue({ ok: false });
    expect(await resolveFederatedAddress('GADDR')).toBe('GADDR');
  });

  it('returns the raw address when stellar.toml has no FEDERATION_SERVER', async () => {
    fetchHomeDomainMock.mockResolvedValue('example.com');
    fetchMock.mockResolvedValue({ ok: true, text: async () => 'SOME_OTHER_KEY = "x"' });
    expect(await resolveFederatedAddress('GADDR')).toBe('GADDR');
  });

  it('returns the raw address when the federation server responds non-ok', async () => {
    fetchHomeDomainMock.mockResolvedValue('example.com');
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'FEDERATION_SERVER = "https://fed.example.com/federation"',
      })
      .mockResolvedValueOnce({ ok: false });
    expect(await resolveFederatedAddress('GADDR')).toBe('GADDR');
  });

  it('resolves to the federated stellar_address on success', async () => {
    fetchHomeDomainMock.mockResolvedValue('example.com');
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'FEDERATION_SERVER = "https://fed.example.com/federation"',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stellar_address: 'alice*example.com' }),
      });
    expect(await resolveFederatedAddress('GADDR')).toBe('alice*example.com');
  });

  it('returns the raw address when fetchHomeDomain throws', async () => {
    fetchHomeDomainMock.mockRejectedValue(new Error('network down'));
    expect(await resolveFederatedAddress('GADDR')).toBe('GADDR');
  });
});

describe('resolveStellarAddressFromName', () => {
  beforeEach(() => {
    dedupedFetchMock.mockClear();
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('throws for a name without a domain separator', async () => {
    await expect(resolveStellarAddressFromName('alice')).rejects.toThrow(
      "Invalid federation name: must contain '*'"
    );
  });

  it('throws when the domain portion is missing', async () => {
    await expect(resolveStellarAddressFromName('alice*')).rejects.toThrow(
      'Invalid federation name: missing domain'
    );
  });

  it('throws when stellar.toml is not found', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    await expect(resolveStellarAddressFromName('alice*example.com')).rejects.toThrow(
      'Federation not supported by example.com'
    );
  });

  it('throws when stellar.toml has no FEDERATION_SERVER', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => 'X = "y"' });
    await expect(resolveStellarAddressFromName('alice*example.com')).rejects.toThrow(
      'No FEDERATION_SERVER found for example.com'
    );
  });

  it('throws when the federation server responds non-ok', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'FEDERATION_SERVER = "https://fed.example.com/federation"',
      })
      .mockResolvedValueOnce({ ok: false });
    await expect(resolveStellarAddressFromName('alice*example.com')).rejects.toThrow(
      'Failed to resolve name alice*example.com'
    );
  });

  it('throws when the response has no account_id', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'FEDERATION_SERVER = "https://fed.example.com/federation"',
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(resolveStellarAddressFromName('alice*example.com')).rejects.toThrow(
      'Invalid response from federation server'
    );
  });

  it('resolves to the account_id on success', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'FEDERATION_SERVER = "https://fed.example.com/federation"',
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ account_id: 'GRESOLVED' }) });
    expect(await resolveStellarAddressFromName('alice*example.com')).toBe('GRESOLVED');
  });

  it('wraps a non-Error rejection in a descriptive Error', async () => {
    fetchMock.mockImplementation(() => {
      throw 'raw string failure';
    });
    await expect(resolveStellarAddressFromName('alice*example.com')).rejects.toThrow(
      'Unable to resolve federation address: raw string failure'
    );
  });
});
