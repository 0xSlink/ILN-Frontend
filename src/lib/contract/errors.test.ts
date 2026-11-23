import { describe, expect, it } from 'vitest';
import {
  CONTRACT_ERROR_MAP,
  ContractErrorCode,
  parseContractError,
  UNKNOWN_CONTRACT_ERROR,
} from './errors';

describe('Contract Error Mapping', () => {
  it('maps InvalidDiscountRate correctly', () => {
    expect(CONTRACT_ERROR_MAP.InvalidDiscountRate.title).toBe('Invalid Discount Rate');
    expect(CONTRACT_ERROR_MAP.InvalidDiscountRate.message).toContain('discount rate');
    expect(CONTRACT_ERROR_MAP.InvalidDiscountRate.remediation).toBeDefined();
  });

  it('ensures all error codes have title and message', () => {
    const keys = Object.keys(CONTRACT_ERROR_MAP) as ContractErrorCode[];
    for (const key of keys) {
      const errorInfo = CONTRACT_ERROR_MAP[key];
      expect(errorInfo.title).toBeTypeOf('string');
      expect(errorInfo.message).toBeTypeOf('string');
    }
  });

  describe('parseContractError', () => {
    it('extracts from plain Error object', () => {
      const err = new Error('InvalidDiscountRate occurred');
      expect(parseContractError(err)).toBe('InvalidDiscountRate');
    });

    it('extracts from string', () => {
      expect(parseContractError('Error: InvoiceNotFound in contract')).toBe('InvoiceNotFound');
    });

    it('extracts from RPC error object (JSON simulation failure)', () => {
      const rpcError = {
        error: 'InsufficientLiquidity',
        code: 400,
      };
      expect(parseContractError(rpcError)).toBe('InsufficientLiquidity');
    });

    it('extracts from deeply nested object with message', () => {
      const err = {
        message: 'Simulation failed with ContractPaused',
      };
      expect(parseContractError(err)).toBe('ContractPaused');
    });

    it('extracts CapExceeded and staged-rollout cap codes correctly', () => {
      expect(parseContractError('Transaction failed: CapExceeded')).toBe('CapExceeded');
      expect(parseContractError(new Error('CapExceeded: amount above initial launch threshold'))).toBe('CapExceeded');
      expect(parseContractError('Error: cap exceeded for staged rollout')).toBe('CapExceeded');
      expect(parseContractError('HostError: Error(Contract, #44)')).toBe('MaxInvoiceAmountExceeded');
      expect(parseContractError('HostError: Error(Contract, #45)')).toBe('GlobalVolumeCapExceeded');
    });

    it('returns null for unknown error', () => {
      expect(parseContractError(new Error('Network disconnect'))).toBeNull();
      expect(parseContractError('Something went wrong')).toBeNull();
      expect(parseContractError({})).toBeNull();
      expect(parseContractError(null)).toBeNull();
      expect(parseContractError(undefined)).toBeNull();
    });
  });

  describe('Fallback behavior', () => {
    it('defines UNKNOWN_CONTRACT_ERROR safely', () => {
      expect(UNKNOWN_CONTRACT_ERROR.title).toBeDefined();
      expect(UNKNOWN_CONTRACT_ERROR.message).toBeDefined();
      expect(UNKNOWN_CONTRACT_ERROR.remediation).toBeDefined();
    });
  });
});
