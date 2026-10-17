import { describe, expect, it } from 'vitest';
import type { DecodedTransaction } from '../decodeTransaction';
import { findTransactionPatternMismatches } from '../transactionPattern';

const fundTransaction: DecodedTransaction = {
  sourceAccount: 'GTEST',
  fee: '100',
  networkPassphrase: null,
  transactionType: 'unknown',
  operations: [
    {
      contract: 'CTEST',
      functionName: 'fund_invoice',
      args: [
        { name: 'arg0', type: 'address', value: 'GTEST' },
        { name: 'arg1', type: 'u64', value: '42' },
        { name: 'arg2', type: 'i128', value: '1000000' },
      ],
      rawArgs: [],
    },
  ],
};

describe('findTransactionPatternMismatches', () => {
  it('accepts a legitimate transaction for the UI action that initiated it', () => {
    expect(findTransactionPatternMismatches(fundTransaction, 'fund_invoice')).toEqual([]);
  });

  it('flags a payload that does not match the action that initiated it', () => {
    const mismatches = findTransactionPatternMismatches(fundTransaction, 'cast_vote');

    expect(mismatches).toContain('Expected cast_vote, but the payload calls fund_invoice.');
    expect(mismatches).toHaveLength(2);
  });

  it('flags additional operations that could hide an injected transfer', () => {
    const mismatches = findTransactionPatternMismatches(
      {
        ...fundTransaction,
        operations: [
          ...fundTransaction.operations,
          { ...fundTransaction.operations[0], functionName: 'transfer' },
        ],
      },
      'fund_invoice'
    );

    expect(mismatches).toContain('Expected one fund_invoice operation, but found 2 operations.');
  });
});
