import { describe, expect, it } from 'vitest';
import {
  parseContractError,
  CONTRACT_ERROR_MAP,
  UNKNOWN_CONTRACT_ERROR,
  type ContractErrorCode,
} from '@/lib/contract/errors';

describe('CONTRACT_ERROR_MAP', () => {
  it('provides a title, message, and remediation for every error code', () => {
    for (const info of Object.values(CONTRACT_ERROR_MAP)) {
      expect(info.title).toBeTruthy();
      expect(info.message).toBeTruthy();
      expect(info.remediation).toBeTruthy();
    }
  });
});

describe('parseContractError', () => {
  it('returns null for falsy input', () => {
    expect(parseContractError(null)).toBeNull();
    expect(parseContractError(undefined)).toBeNull();
    expect(parseContractError('')).toBeNull();
  });

  it('matches a known code from a plain string', () => {
    expect(parseContractError('Contract call failed: Unauthorized')).toBe('Unauthorized');
  });

  it('returns null when a string matches no known code', () => {
    expect(parseContractError('Something went completely wrong')).toBeNull();
  });

  it('matches a known code from an Error message', () => {
    const err = new Error('Simulation failed: InsufficientBalance');
    expect(parseContractError(err)).toBe('InsufficientBalance');
  });

  it('matches a known code from an Error name when the message does not match', () => {
    class InvoiceExpired extends Error {
      name = 'InvoiceExpired';
    }
    expect(parseContractError(new InvoiceExpired('generic failure'))).toBe('InvoiceExpired');
  });

  it('returns null for an Error whose message and name match no known code', () => {
    expect(parseContractError(new Error('totally unrelated failure'))).toBeNull();
  });

  it('matches a known code from an object with a message property', () => {
    expect(parseContractError({ message: 'ContractPaused for maintenance' })).toBe(
      'ContractPaused'
    );
  });

  it('matches a known code from an object with an error property', () => {
    expect(parseContractError({ error: 'TokenNotSupported' })).toBe('TokenNotSupported');
  });

  it('matches a known code found only in the JSON-stringified object payload', () => {
    expect(parseContractError({ details: { reason: 'ArithmeticOverflow' } })).toBe(
      'ArithmeticOverflow'
    );
  });

  it('handles circular objects without throwing and returns null when nothing matches', () => {
    const circular: Record<string, unknown> = { message: 'unrelated failure' };
    circular.self = circular;
    expect(() => parseContractError(circular)).not.toThrow();
    expect(parseContractError(circular)).toBeNull();
  });

  it('returns null for non-string, non-object, non-Error values', () => {
    expect(parseContractError(42)).toBeNull();
  });

  it('resolves every known error code end-to-end via CONTRACT_ERROR_MAP', () => {
    for (const code of Object.keys(CONTRACT_ERROR_MAP) as ContractErrorCode[]) {
      const resolved = parseContractError(`Host error: ${code}`);
      expect(resolved).toBe(code);
      expect(CONTRACT_ERROR_MAP[resolved as ContractErrorCode]).toBeDefined();
    }
  });
});

describe('UNKNOWN_CONTRACT_ERROR', () => {
  it('provides a generic fallback title, message, and remediation', () => {
    expect(UNKNOWN_CONTRACT_ERROR.title).toBeTruthy();
    expect(UNKNOWN_CONTRACT_ERROR.message).toBeTruthy();
    expect(UNKNOWN_CONTRACT_ERROR.remediation).toBeTruthy();
  });
});
