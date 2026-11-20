import { describe, expect, it } from 'vitest';
import { formatContractError } from '../contractErrorFormatter';

describe('formatContractError', () => {
  it('handles null/undefined error gracefully', () => {
    const res = formatContractError(null);
    expect(res.code).toBe('UNKNOWN_ERROR');
    expect(res.userFriendlyMessage).toContain('unexpected error occurred');
  });

  it('maps user rejection correctly', () => {
    const res = formatContractError(new Error('User rejected the transaction'));
    expect(res.code).toBe('USER_REJECTED');
    expect(res.userFriendlyMessage).toContain('rejected in your wallet');
  });

  it('maps insufficient balance correctly', () => {
    const res = formatContractError('Transaction exceeds balance');
    expect(res.code).toBe('INSUFFICIENT_FUNDS');
    expect(res.userFriendlyMessage).toContain('Insufficient balance');
  });

  it('maps CapExceeded specifically with user-friendly message', () => {
    const res = formatContractError('Transaction simulation failed: CapExceeded');
    expect(res.code).toBe('CAP_EXCEEDED');
    expect(res.userFriendlyMessage).toContain('exceeds the active launch cap set by governance');
  });

  it('maps MaxInvoiceAmountExceeded specifically', () => {
    const res = formatContractError(new Error('MaxInvoiceAmountExceeded: limit is 5000'));
    expect(res.code).toBe('CAP_EXCEEDED');
    expect(res.userFriendlyMessage).toContain('exceeds the active launch cap set by governance');
  });

  it('maps GlobalVolumeCapExceeded specifically', () => {
    const res = formatContractError('GlobalVolumeCapExceeded: volume threshold hit');
    expect(res.code).toBe('CAP_EXCEEDED');
    expect(res.userFriendlyMessage).toContain('exceeds the active launch cap set by governance');
  });

  it('maps Soroban numeric contract error #44 (MaxInvoiceAmountExceeded)', () => {
    const res = formatContractError('HostError: Error(Contract, #44)');
    expect(res.code).toBe('CAP_EXCEEDED');
    expect(res.userFriendlyMessage).toContain('exceeds the active launch cap set by governance');
  });

  it('maps Soroban numeric contract error #45 (GlobalVolumeCapExceeded)', () => {
    const res = formatContractError('HostError: Error(Contract, #45)');
    expect(res.code).toBe('CAP_EXCEEDED');
    expect(res.userFriendlyMessage).toContain('exceeds the active launch cap set by governance');
  });

  it('falls back to SIMULATION_FAILED for other host errors', () => {
    const res = formatContractError('HostError: Error(Contract, #12)');
    expect(res.code).toBe('SIMULATION_FAILED');
    expect(res.userFriendlyMessage).toContain('Contract simulation failed');
  });
});
