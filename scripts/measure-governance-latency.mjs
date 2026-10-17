#!/usr/bin/env node
/**
 * Measures the real network latency of the stages a governance transaction
 * goes through, for validating docs/slos.md (#960).
 *
 * Governance write paths in src/utils/governance.ts are still mocked (fixed
 * setTimeout + fake tx hash, see #850/#852), so the full vote journey cannot
 * be timed end-to-end yet. This script times every network stage a real
 * governance write will take, against a live Soroban RPC:
 *
 *   read      simulateTransaction(list_proposals) — exactly what fetchProposals() sends
 *   account   getAccount — sequence-number fetch before building a write
 *   prepare   prepareTransaction(cast_vote) — simulation + footprint/fee assembly
 *   submit    sendTransaction → getTransaction polling until SUCCESS/FAILED
 *             (opt-in via --submit, testnet only: friendbot-funds a throwaway
 *             account and submits a real Soroban invocation of the native XLM
 *             asset contract's read-only `balance`, so it goes through
 *             consensus but changes no state)
 *
 * Wallet signing time (user confirming in Freighter) is human time and is not
 * measured here.
 *
 * Usage:
 *   node scripts/measure-governance-latency.mjs [--samples 20] [--submit] [--json out.json]
 * Env:
 *   NEXT_PUBLIC_RPC_URL                (default https://soroban-testnet.stellar.org)
 *   NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID (default NEXT_PUBLIC_CONTRACT_ID, as in src/constants.ts)
 *   NEXT_PUBLIC_CONTRACT_ID            (default testnet invoice contract)
 */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

export function summarize(samples) {
  const ok = samples.filter((s) => s.ok).map((s) => s.ms);
  const round = (v) => (v === null ? null : Math.round(v));
  return {
    n: samples.length,
    errors: samples.length - ok.length,
    p50: round(percentile(ok, 50)),
    p95: round(percentile(ok, 95)),
    max: ok.length ? round(Math.max(...ok)) : null,
  };
}

export async function timed(fn) {
  const start = performance.now();
  try {
    const value = await fn();
    return { ok: true, ms: performance.now() - start, value };
  } catch (error) {
    return { ok: false, ms: performance.now() - start, error: String(error?.message ?? error) };
  }
}

function parseArgs(argv) {
  const args = { samples: 20, submit: false, json: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--samples') args.samples = Number(argv[++i]);
    else if (argv[i] === '--submit') args.submit = true;
    else if (argv[i] === '--json') args.json = argv[++i];
  }
  return args;
}

async function main() {
  const {
    rpc,
    TransactionBuilder,
    Account,
    Asset,
    BASE_FEE,
    Operation,
    Keypair,
    Networks,
    nativeToScVal,
  } = await import('@stellar/stellar-sdk');
  const args = parseArgs(process.argv.slice(2));
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org';
  const contractId =
    process.env.NEXT_PUBLIC_CONTRACT_ID ||
    'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC';
  const governanceId = process.env.NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID || contractId;
  const passphrase = rpcUrl.includes('mainnet') ? Networks.PUBLIC : Networks.TESTNET;
  const server = new rpc.Server(rpcUrl);

  const invoke = (source, contract, fn, fnArgs = []) =>
    new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase })
      .addOperation(Operation.invokeContractFunction({ contract, function: fn, args: fnArgs }))
      .setTimeout(30)
      .build();

  const readAccount = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
  const results = { rpcUrl, governanceId, samples: args.samples, stages: {}, notes: [] };

  const read = [];
  let governanceAvailable = false;
  for (let i = 0; i < args.samples; i++) {
    const r = await timed(() =>
      server.simulateTransaction(invoke(readAccount, governanceId, 'list_proposals'))
    );
    if (r.ok && rpc.Api.isSimulationSuccess(r.value)) governanceAvailable = true;
    read.push(r);
  }
  results.stages.read = summarize(read);
  results.governanceContractAvailable = governanceAvailable;
  if (!governanceAvailable) {
    results.notes.push(
      `list_proposals is not exposed by ${governanceId}: the app falls back to MOCK_PROPOSALS after this round trip.`
    );
  }

  let signer = null;
  if (args.submit) {
    if (passphrase !== Networks.TESTNET) throw new Error('--submit is testnet-only');
    signer = Keypair.random();
    const fund = await fetch(`https://friendbot.stellar.org/?addr=${signer.publicKey()}`);
    if (!fund.ok) throw new Error(`friendbot funding failed: ${fund.status}`);
  }
  const voter = signer ? signer.publicKey() : readAccount.accountId();

  const account = [];
  const prepare = [];
  for (let i = 0; i < args.samples; i++) {
    if (signer) account.push(await timed(() => server.getAccount(voter)));
    const source = signer ? await server.getAccount(voter) : readAccount;
    prepare.push(
      await timed(() =>
        server.prepareTransaction(
          invoke(source, governanceId, 'cast_vote', [
            nativeToScVal(voter, { type: 'address' }),
            nativeToScVal(1, { type: 'u64' }),
            nativeToScVal(true),
          ])
        )
      )
    );
  }
  if (account.length) results.stages.account = summarize(account);
  // prepareTransaction fails when the contract has no cast_vote; the round
  // trip (simulation) is still real, so time it either way.
  results.stages.prepare = summarize(prepare.map((s) => ({ ...s, ok: true })));
  results.stages.prepare.contractErrors = prepare.filter((s) => !s.ok).length;

  if (signer) {
    const submit = [];
    const submitSamples = Math.min(args.samples, 10);
    for (let i = 0; i < submitSamples; i++) {
      const r = await timed(async () => {
        const source = await server.getAccount(signer.publicKey());
        const tx = await server.prepareTransaction(
          invoke(source, Asset.native().contractId(passphrase), 'balance', [
            nativeToScVal(signer.publicKey(), { type: 'address' }),
          ])
        );
        tx.sign(signer);
        const sent = await server.sendTransaction(tx);
        if (sent.status === 'ERROR') throw new Error('sendTransaction returned ERROR');
        for (;;) {
          const got = await server.getTransaction(sent.hash);
          if (got.status === 'SUCCESS') return got;
          if (got.status === 'FAILED') throw new Error('transaction failed');
          await new Promise((r) => setTimeout(r, 500));
        }
      });
      submit.push(r);
    }
    results.stages.submitToConfirm = summarize(submit);
    results.notes.push(
      'submitToConfirm = getAccount + prepareTransaction + sendTransaction + poll getTransaction until SUCCESS (500 ms poll interval).'
    );
  }

  const report = JSON.stringify(results, null, 2) + '\n';
  process.stdout.write(report);
  if (args.json) writeFileSync(args.json, report);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
