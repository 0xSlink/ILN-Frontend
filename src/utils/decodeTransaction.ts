import { xdr, TransactionBuilder, Address } from '@stellar/stellar-sdk';

export interface DecodedOperation {
  contract: string | null;
  functionName: string;
  args: Array<{ name: string; value: string; type: string }>;
  rawArgs: xdr.ScVal[];
}

export interface DecodedTransaction {
  sourceAccount: string;
  fee: string;
  networkPassphrase: string | null;
  operations: DecodedOperation[];
  transactionType: 'unknown';
}

function formatScVal(val: xdr.ScVal): { value: string; type: string } {
  try {
    const switchCase = val.switch().name;

    switch (switchCase) {
      case 'scvBool':
        return { value: String(val.b()), type: 'bool' };
      case 'scvVoid':
        return { value: '(void)', type: 'void' };
      case 'scvU32':
        return { value: String(val.u32()), type: 'u32' };
      case 'scvI32':
        return { value: String(val.i32()), type: 'i32' };
      case 'scvU64':
        return { value: val.u64().toString(), type: 'u64' };
      case 'scvI64':
        return { value: val.i64().toString(), type: 'i64' };
      case 'scvU128': {
        const u128 = val.u128();
        return {
          value: String(
            BigInt(u128.hi().toString()) * (BigInt(1) << BigInt(64)) + BigInt(u128.lo().toString())
          ),
          type: 'u128',
        };
      }
      case 'scvI128': {
        const i128 = val.i128();
        return {
          value: String(
            BigInt(i128.hi().toString()) * (BigInt(1) << BigInt(64)) + BigInt(i128.lo().toString())
          ),
          type: 'i128',
        };
      }
      case 'scvBytes':
        return { value: `bytes(${val.bytes().length} bytes)`, type: 'bytes' };
      case 'scvString':
        return { value: String(val.str()), type: 'string' };
      case 'scvSymbol':
        return { value: String(val.sym()), type: 'symbol' };
      case 'scvAddress': {
        try {
          return { value: Address.fromScAddress(val.address()).toString(), type: 'address' };
        } catch {
          return { value: '(address)', type: 'address' };
        }
      }
      case 'scvVec': {
        const vec = val.vec();
        return { value: `[${vec?.length ?? 0} items]`, type: 'vec' };
      }
      case 'scvMap': {
        const map = val.map();
        return { value: `{${map?.length ?? 0} entries}`, type: 'map' };
      }
      case 'scvContractInstance':
        return { value: '(contract instance)', type: 'contractInstance' };
      case 'scvLedgerKeyNonce':
        return { value: '(nonce)', type: 'nonce' };
      default:
        return { value: `(${switchCase})`, type: switchCase || 'unknown' };
    }
  } catch {
    return { value: '(unable to decode)', type: 'unknown' };
  }
}

function decodeInvokeContractArgs(func: xdr.HostFunction): {
  contract: string | null;
  functionName: string;
  args: xdr.ScVal[];
} | null {
  try {
    const args = func.invokeContract();
    const contractAddress = args.contractAddress();
    const contract = Address.fromScAddress(contractAddress).toString();
    const functionName = args.functionName().toString();
    const fnArgs = args.args();
    return { contract, functionName, args: fnArgs };
  } catch {
    return null;
  }
}

function decodeOperation(op: xdr.Operation): DecodedOperation {
  const body = op.body();
  const switchCase = body.switch().name;

  if (switchCase === 'invokeHostFunction') {
    const invokeArgs = body.invokeHostFunctionOp();
    const hostFunction = invokeArgs.hostFunction();
    const hostFuncType = hostFunction.switch().name;

    if (hostFuncType === 'hostFunctionTypeInvokeContract') {
      const decoded = decodeInvokeContractArgs(hostFunction);
      if (decoded) {
        return {
          contract: decoded.contract,
          functionName: decoded.functionName,
          args: decoded.args.map((arg: xdr.ScVal, i: number) => ({
            name: `arg${i}`,
            ...formatScVal(arg),
          })),
          rawArgs: decoded.args,
        };
      }
    }

    return {
      contract: null,
      functionName: `hostFunction(${hostFuncType})`,
      args: [],
      rawArgs: [],
    };
  }

  return {
    contract: null,
    functionName: switchCase,
    args: [],
    rawArgs: [],
  };
}

export function decodeTransactionXdr(xdrBase64: string): DecodedTransaction | null {
  try {
    const tx = TransactionBuilder.fromXDR(xdrBase64, '');

    const envelope = tx.toEnvelope();
    const txV1 = envelope.v1();
    if (!txV1) {
      return null;
    }

    const transaction = txV1.tx();
    const sourceAccount = transaction.sourceAccount().toString();
    const fee = transaction.fee().toString();
    const operations = transaction.operations().map(decodeOperation);

    let networkPassphrase: string | null = null;
    try {
      const signers = txV1.signatures();
      if (signers.length > 0) {
        const signatureHint = signers[0].hint();
        networkPassphrase = `hint(${Buffer.from(signatureHint).toString('hex')})`;
      }
    } catch {
      // Network passphrase not directly accessible from envelope
    }

    return {
      sourceAccount,
      fee,
      networkPassphrase,
      operations,
      transactionType: 'unknown',
    };
  } catch {
    return null;
  }
}
