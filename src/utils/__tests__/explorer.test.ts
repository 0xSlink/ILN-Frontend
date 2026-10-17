import { describe, expect, it } from 'vitest';
import {
  isValidTxHash,
  isValidStellarAccountAddress,
  isValidStellarContractId,
  getExplorerNetworkPath,
  getExplorerTxUrl,
  getExplorerAccountUrl,
  getExplorerContractUrl,
} from '../explorer';

describe('explorer utils', () => {
  const validTxHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const validAccount = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
  const validContract = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHD';

  describe('isValidTxHash', () => {
    it('returns true for 64-char hex hash', () => {
      expect(isValidTxHash(validTxHash)).toBe(true);
      expect(isValidTxHash(validTxHash.toUpperCase())).toBe(true);
    });

    it('returns false for mock short strings, non-hex, or empty', () => {
      expect(isValidTxHash('abc123')).toBe(false);
      expect(isValidTxHash('')).toBe(false);
      expect(isValidTxHash(null)).toBe(false);
      expect(isValidTxHash(undefined)).toBe(false);
      expect(isValidTxHash('g'.repeat(64))).toBe(false); // non-hex
      expect(isValidTxHash('12345')).toBe(false);
    });
  });

  describe('isValidStellarAccountAddress', () => {
    it('returns true for valid G address with 56 chars', () => {
      expect(isValidStellarAccountAddress(validAccount)).toBe(true);
    });

    it('returns false for non-G address or wrong length', () => {
      expect(isValidStellarAccountAddress(validContract)).toBe(false);
      expect(isValidStellarAccountAddress('G123')).toBe(false);
      expect(isValidStellarAccountAddress('')).toBe(false);
    });
  });

  describe('isValidStellarContractId', () => {
    it('returns true for valid C contract ID with 56 chars', () => {
      expect(isValidStellarContractId(validContract)).toBe(true);
    });

    it('returns false for non-C ID or wrong length', () => {
      expect(isValidStellarContractId(validAccount)).toBe(false);
      expect(isValidStellarContractId('C123')).toBe(false);
    });
  });

  describe('getExplorerNetworkPath', () => {
    it('normalizes mainnet / public to public', () => {
      expect(getExplorerNetworkPath('public')).toBe('public');
      expect(getExplorerNetworkPath('MAINNET')).toBe('public');
      expect(getExplorerNetworkPath('main')).toBe('public');
    });

    it('normalizes testnet / futurenet / other to testnet', () => {
      expect(getExplorerNetworkPath('testnet')).toBe('testnet');
      expect(getExplorerNetworkPath('TESTNET')).toBe('testnet');
      expect(getExplorerNetworkPath('futurenet')).toBe('testnet');
    });
  });

  describe('getExplorerTxUrl', () => {
    it('generates valid explorer url for valid hash', () => {
      const url = getExplorerTxUrl(validTxHash, 'testnet');
      expect(url).toBe(`https://stellar.expert/explorer/testnet/tx/${validTxHash}`);
    });

    it('uses public for mainnet', () => {
      const url = getExplorerTxUrl(validTxHash, 'mainnet');
      expect(url).toBe(`https://stellar.expert/explorer/public/tx/${validTxHash}`);
    });

    it('returns null for invalid or mock tx hashes', () => {
      expect(getExplorerTxUrl('mock-hash-123')).toBeNull();
      expect(getExplorerTxUrl('')).toBeNull();
      expect(getExplorerTxUrl(undefined)).toBeNull();
      expect(getExplorerTxUrl(null)).toBeNull();
    });
  });

  describe('getExplorerAccountUrl and getExplorerContractUrl', () => {
    it('generates account url for valid address and null otherwise', () => {
      expect(getExplorerAccountUrl(validAccount, 'testnet')).toBe(
        `https://stellar.expert/explorer/testnet/account/${validAccount}`
      );
      expect(getExplorerAccountUrl('invalid-addr')).toBeNull();
    });

    it('generates contract url for valid contract id and null otherwise', () => {
      expect(getExplorerContractUrl(validContract, 'testnet')).toBe(
        `https://stellar.expert/explorer/testnet/contract/${validContract}`
      );
      expect(getExplorerContractUrl('invalid-id')).toBeNull();
    });
  });
});
