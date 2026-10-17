import { describe, expect, it } from 'vitest';
import {
  Address,
  TransactionBuilder,
  Account,
  Operation,
  xdr,
  nativeToScVal,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { decodeTransactionXdr } from '../decodeTransaction';

const SOURCE = 'GDJ4GRVMN5OS6LOT57YCT6LX532KIOVF6HRHX44WFNCD2K6JCMJPLORR';
const CONTRACT = 'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC';
const NETWORK = 'Test SDF Network ; September 2015';

function buildInvokeContractXdr(
  functionName: string,
  args: xdr.ScVal[],
  contractAddress = CONTRACT
): string {
  const account = new Account(SOURCE, '0');
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          new xdr.InvokeContractArgs({
            contractAddress: Address.fromString(contractAddress).toScAddress(),
            functionName,
            args,
          })
        ),
        auth: [],
      })
    )
    .setTimeout(60)
    .build();

  return tx.toXDR();
}

function buildInvokeContractFunctionXdr(
  functionName: string,
  args: xdr.ScVal[],
  contractAddress = CONTRACT
): string {
  const account = new Account(SOURCE, '0');
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractAddress,
        function: functionName,
        args,
      })
    )
    .setTimeout(60)
    .build();

  return tx.toXDR();
}

describe('decodeTransactionXdr', () => {
  it('decodes a fund_invoice transaction', () => {
    const funder = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const invoiceId = 42n;
    const amount = 10000000n;

    const xdrBase64 = buildInvokeContractXdr('fund_invoice', [
      Address.fromString(funder).toScVal(),
      nativeToScVal(invoiceId, { type: 'u64' }),
      nativeToScVal(amount, { type: 'i128' }),
    ]);

    const decoded = decodeTransactionXdr(xdrBase64);

    expect(decoded).not.toBeNull();
    expect(decoded!.sourceAccount).toBe(SOURCE);
    expect(decoded!.operations).toHaveLength(1);

    const op = decoded!.operations[0];
    expect(op.functionName).toBe('fund_invoice');
    expect(op.contract).toBe(CONTRACT);
    expect(op.args).toHaveLength(3);
    expect(op.args[0].type).toBe('address');
    expect(op.args[0].value).toBe(funder);
    expect(op.args[1].type).toBe('u64');
    expect(op.args[1].value).toBe('42');
    expect(op.args[2].type).toBe('i128');
    expect(op.args[2].value).toBe('10000000');
  });

  it('decodes a mark_paid transaction', () => {
    const invoiceId = 7n;
    const amount = 5000000n;

    const xdrBase64 = buildInvokeContractXdr('mark_paid', [
      nativeToScVal(invoiceId, { type: 'u64' }),
      nativeToScVal(amount, { type: 'i128' }),
    ]);

    const decoded = decodeTransactionXdr(xdrBase64);

    expect(decoded).not.toBeNull();
    expect(decoded!.operations).toHaveLength(1);

    const op = decoded!.operations[0];
    expect(op.functionName).toBe('mark_paid');
    expect(op.contract).toBe(CONTRACT);
    expect(op.args).toHaveLength(2);
    expect(op.args[0].value).toBe('7');
    expect(op.args[1].value).toBe('5000000');
  });

  it('decodes a cast_vote transaction (governance)', () => {
    const voter = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const proposalId = 100n;
    const vote = 1n;

    const GOVERNANCE_CONTRACT = 'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC';

    const xdrBase64 = buildInvokeContractXdr(
      'cast_vote',
      [
        Address.fromString(voter).toScVal(),
        nativeToScVal(proposalId, { type: 'u64' }),
        nativeToScVal(vote, { type: 'u32' }),
      ],
      GOVERNANCE_CONTRACT
    );

    const decoded = decodeTransactionXdr(xdrBase64);

    expect(decoded).not.toBeNull();
    expect(decoded!.operations).toHaveLength(1);

    const op = decoded!.operations[0];
    expect(op.functionName).toBe('cast_vote');
    expect(op.contract).toBe(GOVERNANCE_CONTRACT);
    expect(op.args).toHaveLength(3);
    expect(op.args[0].type).toBe('address');
    expect(op.args[0].value).toBe(voter);
    expect(op.args[1].value).toBe('100');
    expect(op.args[2].value).toBe('1');
  });

  it('decodes a submit_invoice transaction via invokeContractFunction', () => {
    const freelancer = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const payer = 'GDJ4GRVMN5OS6LOT57YCT6LX532KIOVF6HRHX44WFNCD2K6JCMJPLORR';
    const amount = 1000000n;
    const dueDate = 1700000000n;
    const discountRate = 500;

    const xdrBase64 = buildInvokeContractFunctionXdr('submit_invoice', [
      Address.fromString(freelancer).toScVal(),
      Address.fromString(payer).toScVal(),
      nativeToScVal(amount, { type: 'i128' }),
      nativeToScVal(dueDate, { type: 'u64' }),
      nativeToScVal(discountRate, { type: 'u32' }),
    ]);

    const decoded = decodeTransactionXdr(xdrBase64);

    expect(decoded).not.toBeNull();
    expect(decoded!.operations).toHaveLength(1);

    const op = decoded!.operations[0];
    expect(op.functionName).toBe('submit_invoice');
    expect(op.args).toHaveLength(5);
    expect(op.args[0].type).toBe('address');
    expect(op.args[0].value).toBe(freelancer);
    expect(op.args[1].type).toBe('address');
    expect(op.args[1].value).toBe(payer);
    expect(op.args[2].type).toBe('i128');
    expect(op.args[2].value).toBe('1000000');
    expect(op.args[3].type).toBe('u64');
    expect(op.args[3].value).toBe('1700000000');
    expect(op.args[4].type).toBe('u32');
    expect(op.args[4].value).toBe('500');
  });

  it('returns null for invalid XDR', () => {
    expect(decodeTransactionXdr('not-valid-xdr')).toBeNull();
    expect(decodeTransactionXdr('')).toBeNull();
    expect(decodeTransactionXdr('AAAA')).toBeNull();
  });

  it('detects a tampered payload by decoding the actual (modified) content', () => {
    const originalXdr = buildInvokeContractXdr('fund_invoice', [
      Address.fromString(SOURCE).toScVal(),
      nativeToScVal(42n, { type: 'u64' }),
      nativeToScVal(10000000n, { type: 'i128' }),
    ]);

    const decoded = decodeTransactionXdr(originalXdr);
    expect(decoded).not.toBeNull();
    expect(decoded!.operations[0].functionName).toBe('fund_invoice');

    // Tamper: decode a different transaction type to show the preview
    // would catch the mismatch
    const tamperedXdr = buildInvokeContractXdr('mark_paid', [
      nativeToScVal(999n, { type: 'u64' }),
      nativeToScVal(20000000n, { type: 'i128' }),
    ]);

    const tamperedDecoded = decodeTransactionXdr(tamperedXdr);
    expect(tamperedDecoded).not.toBeNull();

    // The tampered transaction should show mark_paid, not fund_invoice
    // This is exactly what the preview modal would reveal to the user
    expect(tamperedDecoded!.operations[0].functionName).toBe('mark_paid');
    expect(decoded!.operations[0].functionName).not.toBe(
      tamperedDecoded!.operations[0].functionName
    );

    // Verify the tampered args are different too
    expect(decoded!.operations[0].args[1].value).toBe('42');
    expect(tamperedDecoded!.operations[0].args[0].value).toBe('999');
  });

  it('extracts the source account from the transaction', () => {
    const xdrBase64 = buildInvokeContractXdr('get_invoice_count', []);

    const decoded = decodeTransactionXdr(xdrBase64);

    expect(decoded).not.toBeNull();
    expect(decoded!.sourceAccount).toBe(SOURCE);
  });

  it('returns the fee in stroops', () => {
    const xdrBase64 = buildInvokeContractXdr('get_invoice_count', []);

    const decoded = decodeTransactionXdr(xdrBase64);

    expect(decoded).not.toBeNull();
    expect(decoded!.fee).toBe(String(BASE_FEE));
  });
});
