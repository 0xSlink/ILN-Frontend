#!/usr/bin/env node
import fs from 'node:fs';
import StellarSdk from '@stellar/stellar-sdk';

const { Account, BASE_FEE, Networks, Operation, nativeToScVal, rpc, TransactionBuilder } =
  StellarSdk;

const pin = JSON.parse(fs.readFileSync(new URL('../contracts/contract-pin.json', import.meta.url)));
const rpcUrl = process.env.TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org';
const contractId = process.env.TESTNET_INVOICE_CONTRACT_ID || pin.contracts.invoice;
const source = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

if (!contractId || !/^C[A-Z2-7]{55}$/.test(contractId)) {
  throw new Error('TESTNET_INVOICE_CONTRACT_ID or contracts.invoice must be a valid contract ID');
}

const server = new rpc.Server(rpcUrl);
const health = await server.getHealth();
if (health.status !== 'healthy') throw new Error(`Soroban testnet RPC is ${health.status}`);

const account = new Account(source, '0');
const transaction = new TransactionBuilder(account, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.invokeContractFunction({
      contract: contractId,
      function: 'get_invoice',
      args: [nativeToScVal(1n, { type: 'u64' })],
    })
  )
  .setTimeout(30)
  .build();

const result = await server.simulateTransaction(transaction);
if (!rpc.Api.isSimulationSuccess(result) || !result.result?.retval) {
  if (typeof result.error === 'string' && result.error.includes('Error(Contract, #1)')) {
    console.log(
      `Testnet contract call passed: get_invoice returned expected InvoiceNotFound for ID 1 (${contractId})`
    );
  } else {
    throw new Error(`get_invoice simulation failed: ${JSON.stringify(result)}`);
  }
} else {
  console.log(`Testnet contract read passed for ${contractId}`);
}
