import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEnvFile,
  checkEnvExampleSync,
  detectConfigurationDrift,
  verifyDomainRequirements,
  REQUIRED_DOMAIN_VARIABLES,
  CONFIG_DIFF_SPEC,
} from '../check-env-example.mjs';

test('verifyDomainRequirements passes for valid production and testnet configs', () => {
  const testnetEnv = parseEnvFile('.env.local.example');
  const prodEnv = parseEnvFile('.env.production.example');

  const testnetCheck = verifyDomainRequirements(testnetEnv, { isProduction: false });
  assert.equal(testnetCheck.success, true);
  assert.equal(testnetCheck.errors.length, 0);

  const prodCheck = verifyDomainRequirements(prodEnv, { isProduction: true, strictSecrets: false });
  assert.equal(prodCheck.success, true);
  assert.equal(prodCheck.errors.length, 0);
  assert.equal(prodCheck.passed.length >= 14, true);
});

test('verifyDomainRequirements fails closed when indexer variables are missing or point to localhost in production', () => {
  const badProdEnv = {
    ...parseEnvFile('.env.production.example'),
    NEXT_PUBLIC_INDEXER_API_URL: 'http://localhost:8080',
    INDEXER_URL: 'http://127.0.0.1:8080',
    NEXT_PUBLIC_INDEXER_WS_URL: 'ws://localhost:8080/ws',
  };

  const check = verifyDomainRequirements(badProdEnv, { isProduction: true });
  assert.equal(check.success, false);
  assert.equal(
    check.errors.some((e) => e.key === 'NEXT_PUBLIC_INDEXER_API_URL'),
    true
  );
  assert.equal(
    check.errors.some((e) => e.key === 'INDEXER_URL'),
    true
  );
  assert.equal(
    check.errors.some((e) => e.key === 'NEXT_PUBLIC_INDEXER_WS_URL'),
    true
  );
});

test('verifyDomainRequirements fails closed when RPC variables are missing or use testnet in production', () => {
  const badProdEnv = {
    ...parseEnvFile('.env.production.example'),
    NEXT_PUBLIC_RPC_URL: 'https://soroban-testnet.stellar.org',
    NEXT_PUBLIC_STELLAR_NETWORK: 'testnet',
    NEXT_PUBLIC_CONTRACT_ID: 'bad-contract-id',
  };

  const check = verifyDomainRequirements(badProdEnv, { isProduction: true });
  assert.equal(check.success, false);
  assert.equal(
    check.errors.some((e) => e.key === 'NEXT_PUBLIC_RPC_URL'),
    true
  );
  assert.equal(
    check.errors.some((e) => e.key === 'NEXT_PUBLIC_STELLAR_NETWORK'),
    true
  );
  assert.equal(
    check.errors.some((e) => e.key === 'NEXT_PUBLIC_CONTRACT_ID'),
    true
  );
});

test('verifyDomainRequirements fails closed when wallet variables are missing or empty in production', () => {
  const badProdEnv = {
    ...parseEnvFile('.env.production.example'),
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: '   ',
  };

  const check = verifyDomainRequirements(badProdEnv, { isProduction: true });
  assert.equal(check.success, false);
  assert.equal(
    check.errors.some((e) => e.key === 'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID'),
    true
  );
});

test('verifyDomainRequirements fails closed when authentication variables are missing or insecure in production', () => {
  const badProdEnv = {
    ...parseEnvFile('.env.production.example'),
    NEXT_PUBLIC_SEP10_WEB_AUTH_ENDPOINT: 'http://api.iln.example.com/auth',
    NEXT_PUBLIC_SEP10_HOME_DOMAIN: 'example.com',
    SEP10_SERVER_SECRET_KEY: '',
  };

  const check = verifyDomainRequirements(badProdEnv, { isProduction: true });
  assert.equal(check.success, false);
  assert.equal(
    check.errors.some((e) => e.key === 'NEXT_PUBLIC_SEP10_WEB_AUTH_ENDPOINT'),
    true
  );
  assert.equal(
    check.errors.some((e) => e.key === 'NEXT_PUBLIC_SEP10_HOME_DOMAIN'),
    true
  );
  assert.equal(
    check.errors.some((e) => e.key === 'SEP10_SERVER_SECRET_KEY'),
    true
  );
});

test('detectConfigurationDrift detects missing production variables and domain requirement violations', () => {
  const testnetEnv = parseEnvFile('.env.local.example');
  const incompleteProdEnv = {
    ...parseEnvFile('.env.production.example'),
  };
  delete incompleteProdEnv.INDEXER_URL;
  delete incompleteProdEnv.NEXT_PUBLIC_SEP10_WEB_AUTH_ENDPOINT;

  const result = detectConfigurationDrift(testnetEnv, incompleteProdEnv);
  assert.equal(result.success, false);
  assert.equal(
    result.errors.some((e) => e.key === 'INDEXER_URL'),
    true
  );
  assert.equal(
    result.errors.some((e) => e.key === 'NEXT_PUBLIC_SEP10_WEB_AUTH_ENDPOINT'),
    true
  );
});

test('checkEnvExampleSync succeeds on current repository and fails when required domain var is missing', () => {
  const baseline = checkEnvExampleSync();
  assert.equal(baseline.success, true);
  assert.equal(baseline.missing.length, 0);

  // When an allowlist is provided that excludes required domain vars
  const brokenDocumented = { ...parseEnvFile('.env.local.example') };
  delete brokenDocumented.NEXT_PUBLIC_RPC_URL;
  const domainCheck = verifyDomainRequirements(brokenDocumented, { isProduction: false });
  assert.equal(domainCheck.success, false);
  assert.equal(
    domainCheck.errors.some((e) => e.key === 'NEXT_PUBLIC_RPC_URL'),
    true
  );
});
