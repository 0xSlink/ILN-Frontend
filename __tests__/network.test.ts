import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  formatNetworkLabel,
  getConfiguredStellarNetwork,
  networksMatch,
  normalizeWalletNetwork,
  getRpcNetworkFromUrl,
  checkRpcMismatch,
  getMismatchDetails,
} from '@/utils/network';

describe('network utils', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('normalizes wallet network names', () => {
    expect(normalizeWalletNetwork('TESTNET')).toBe('testnet');
    expect(normalizeWalletNetwork('PUBLIC')).toBe('mainnet');
    expect(normalizeWalletNetwork('mainnet')).toBe('mainnet');
    expect(normalizeWalletNetwork('MAIN')).toBe('mainnet');
    expect(normalizeWalletNetwork('FUTURENET')).toBe('testnet');
    expect(normalizeWalletNetwork('TEST')).toBe('testnet');
  });

  it('detects matching and mismatching networks', () => {
    vi.stubEnv('NEXT_PUBLIC_STELLAR_NETWORK', 'testnet');
    expect(networksMatch('TESTNET')).toBe(true);
    expect(networksMatch('PUBLIC')).toBe(false);
    expect(getConfiguredStellarNetwork()).toBe('testnet');
  });

  it('formats network labels for UI', () => {
    expect(formatNetworkLabel('testnet')).toBe('Testnet');
    expect(formatNetworkLabel('PUBLIC')).toBe('Mainnet');
  });

  describe('getRpcNetworkFromUrl', () => {
    it('detects testnet RPC URLs', () => {
      expect(getRpcNetworkFromUrl('https://soroban-testnet.stellar.org')).toBe('testnet');
      expect(getRpcNetworkFromUrl('https://rpc-testnet.stellar.org')).toBe('testnet');
    });

    it('detects mainnet RPC URLs', () => {
      expect(getRpcNetworkFromUrl('https://soroban.stellar.org')).toBe('mainnet');
      expect(getRpcNetworkFromUrl('https://rpc.stellar.org')).toBe('mainnet');
      expect(getRpcNetworkFromUrl('https://soroban-mainnet.stellar.org')).toBe('mainnet');
    });

    it('returns null for unknown RPC URLs', () => {
      expect(getRpcNetworkFromUrl('https://custom-rpc.example.com')).toBeNull();
      expect(getRpcNetworkFromUrl('')).toBeNull();
    });
  });

  describe('checkRpcMismatch', () => {
    it('detects mismatch when RPC URL network differs from wallet', () => {
      expect(checkRpcMismatch('https://soroban.stellar.org', 'TESTNET')).toBe(true);
      expect(checkRpcMismatch('https://soroban-testnet.stellar.org', 'PUBLIC')).toBe(true);
    });

    it('returns false when RPC URL matches wallet network', () => {
      expect(checkRpcMismatch('https://soroban-testnet.stellar.org', 'TESTNET')).toBe(false);
      expect(checkRpcMismatch('https://soroban.stellar.org', 'PUBLIC')).toBe(false);
    });

    it('returns false for unknown/custom RPC URLs', () => {
      expect(checkRpcMismatch('https://custom-rpc.example.com', 'TESTNET')).toBe(false);
    });
  });

  describe('getMismatchDetails', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_STELLAR_NETWORK', 'testnet');
      vi.stubEnv('NEXT_PUBLIC_RPC_URL', 'https://soroban-testnet.stellar.org');
      vi.stubEnv('NEXT_PUBLIC_NETWORK_NAME', 'TESTNET');
    });

    it('reports no mismatch when everything matches', () => {
      const details = getMismatchDetails('TESTNET');
      expect(details.walletMismatch).toBe(false);
      expect(details.rpcMismatch).toBe(false);
      expect(details.walletNetwork).toBe('testnet');
      expect(details.appNetwork).toBe('testnet');
    });

    it('reports a mismatch when the wallet is on a different network', () => {
      // rpcMismatch compares the configured RPC's network with the wallet's, so
      // a testnet RPC + a PUBLIC wallet is flagged on both counts.
      const details = getMismatchDetails('PUBLIC');
      expect(details.walletMismatch).toBe(true);
      expect(details.rpcMismatch).toBe(true);
    });

    it('reports both wallet and RPC mismatch', () => {
      vi.stubEnv('NEXT_PUBLIC_RPC_URL', 'https://soroban.stellar.org');
      const details = getMismatchDetails('PUBLIC');
      expect(details.walletMismatch).toBe(true);
      expect(details.rpcMismatch).toBe(true);
    });

    it('includes app network name in details', () => {
      const details = getMismatchDetails('TESTNET');
      expect(details.appNetworkName).toBe('TESTNET');
    });
  });
});
