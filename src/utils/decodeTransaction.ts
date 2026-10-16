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
    const switchCase = val.arm();

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
        return { value: String(val.u64()), type: 'u64' };
      case 'scvI64':
        return { value: String(val.i64()), type: 'i64' };
      case 'scvU128': {
        const u128 = val.u128();
        return {
          value: String(BigInt(u128.hi()) * (BigInt(1) << BigInt(64)) + BigInt(u128.lo())),
          type: 'u128',
        };
      }
      case 'scvI128': {
        const i128 = val.i128();
        return {
          value: String(BigInt(i128.hi()) * (BigInt(1) << BigInt(64)) + BigInt(i128.lo())),
          type: 'i128',
        };
      }
      case 'scvBytes':
        return { value: `bytes(${val.bytes().length} bytes)`, type: 'bytes' };
      case 'scvBytesN': {
        const bytesN = val.bytesN();
        return { value: `bytesN(${bytesN.length} bytes)`, type: 'bytesN' };
      }
      case 'scvString':
        return { value: val.str(), type: 'string' };
      case 'scvSymbol':
        return { value: val.sym().toString(), type: 'symbol' };
      case 'scvAddress': {
        try {
          return { value: Address.fromScAddress(val.address()).toString(), type: 'address' };
        } catch {
          return { value: '(address)', type: 'address' };
        }
      }
      case 'scvVec': {
        const vec = val.vec();
        return { value: `[${vec.length} items]`, type: 'vec' };
      }
      case 'scvMap': {
        const map = val.map();
        return { value: `{${map.length} entries}`, type: 'map' };
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
  const switchCase = body.arm();

  if (switchCase === 'invokeHostFunction') {
    const invokeArgs = body.invokeHostFunctionOp();
    const hostFunction = invokeArgs.hostFunction();
    const hostFuncType = hostFunction.arm();

    if (hostFuncType === 'hostFunctionTypeInvokeContract') {
      const decoded = decodeInvokeContractArgs(hostFunction);
      if (decoded) {
        return {
          contract: decoded.contract,
          functionName: decoded.functionName,
          args: decoded.args.map((arg, i) => ({
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

  if (switchCase === 'invokeContract') {
    const invokeArgs = body.invokeContract();
    const contractAddress = invokeArgs.contractAddress();
    const contract = Address.fromScAddress(contractAddress).toString();
    const functionName = invokeArgs.functionName().toString();
    const fnArgs = invokeArgs.args();
    return {
      contract,
      functionName,
      args: fnArgs.map((arg, i) => ({
        name: `arg${i}`,
        ...formatScVal(arg),
      })),
      rawArgs: fnArgs,
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

    const sourceAccount = Address.fromScAddress(txV1.sourceAccount()).toString();
    const fee = tx.fee.toString();
    const operations = tx.operations.map(decodeOperation);

    let networkPassphrase: string | null = null;
    try {
      const signers = envelope.signatures();
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
