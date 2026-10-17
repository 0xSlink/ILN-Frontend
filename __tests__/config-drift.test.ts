import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  parseEnvFile,
  checkEnvExampleSync,
  detectConfigurationDrift,
  maskValue,
  CONFIG_DIFF_SPEC,
  EXAMPLE_FILE,
  PROD_EXAMPLE_FILE,
} from '../scripts/check-env-example.mjs';

describe('Configuration Drift Detection', () => {
  const root = process.cwd();

  describe('parseEnvFile', () => {
    it('should correctly parse key-value pairs and strip quotes and comments', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      expect(testnetEnv.NEXT_PUBLIC_STELLAR_NETWORK).toBe('testnet');
      expect(testnetEnv.NEXT_PUBLIC_NETWORK_NAME).toBe('TESTNET');
      expect(testnetEnv.NEXT_PUBLIC_NETWORK_PASSPHRASE).toBe('Test SDF Network ; September 2015');
      expect(testnetEnv.NEXT_PUBLIC_CONTRACT_ID).toBe(
        'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC'
      );
    });

    it('should correctly parse production snapshot template', () => {
      const prodEnv = parseEnvFile(PROD_EXAMPLE_FILE, root);
      expect(prodEnv.NEXT_PUBLIC_STELLAR_NETWORK).toBe('public');
      expect(prodEnv.NEXT_PUBLIC_NETWORK_NAME).toBe('PUBLIC');
      expect(prodEnv.NEXT_PUBLIC_NETWORK_PASSPHRASE).toBe(
        'Public Global Stellar Network ; September 2015'
      );
      expect(prodEnv.NEXT_PUBLIC_CONTRACT_ID).toBe(
        'CB7N6E56V4K3Q7ZJ6DLR3W3Q6S5ZPYI32AOGI4A4X67E525U4FOWMAIN'
      );
    });

    it('should throw an error for non-existent files', () => {
      expect(() => parseEnvFile('non-existent.env', root)).toThrow(
        /Environment file not found/
      );
    });
  });

  describe('maskValue', () => {
    it('should mask sensitive secret values', () => {
      expect(maskValue('RESEND_API_KEY', 're_1234567890abcdef')).toBe('re_1...cdef');
      expect(maskValue('CRON_SECRET', 'short')).toBe('********');
    });

    it('should not mask public configuration values', () => {
      expect(maskValue('NEXT_PUBLIC_STELLAR_NETWORK', 'public')).toBe('public');
      expect(maskValue('NEXT_PUBLIC_NETWORK_NAME', 'PUBLIC')).toBe('PUBLIC');
    });
  });

  describe('checkEnvExampleSync', () => {
    it('should confirm that .env.local.example covers all referenced env vars in app/ and src/', () => {
      const result = checkEnvExampleSync({ root });
      expect(result.success).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.documentedCount).toBeGreaterThan(0);
    });
  });

  describe('detectConfigurationDrift with baseline snapshots', () => {
    it('should pass cleanly when comparing testnet example against production example snapshot', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = parseEnvFile(PROD_EXAMPLE_FILE, root);

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.passed.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Schema Parity Violations', () => {
    it('should fail when a variable defined in testnet is missing in production snapshot', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = parseEnvFile(PROD_EXAMPLE_FILE, root);

      delete prodEnv.NEXT_PUBLIC_CONTRACT_ID;

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(false);
      const missingError = report.errors.find((e) => e.key === 'NEXT_PUBLIC_CONTRACT_ID');
      expect(missingError).toBeDefined();
    });
  });

  describe('MUST_DIFFER Rule Violations', () => {
    it('should fail if NEXT_PUBLIC_STELLAR_NETWORK is set to testnet in production', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = { ...parseEnvFile(PROD_EXAMPLE_FILE, root), NEXT_PUBLIC_STELLAR_NETWORK: 'testnet' };

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(false);
      const err = report.errors.find((e) => e.key === 'NEXT_PUBLIC_STELLAR_NETWORK');
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/Must differ from testnet/);
    });

    it('should fail if NEXT_PUBLIC_STELLAR_NETWORK is set to mainnet (must be "public" per runbook)', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = { ...parseEnvFile(PROD_EXAMPLE_FILE, root), NEXT_PUBLIC_STELLAR_NETWORK: 'mainnet' };

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(false);
      const err = report.errors.find((e) => e.key === 'NEXT_PUBLIC_STELLAR_NETWORK');
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/Must be 'public' \(not 'mainnet'/);
    });

    it('should fail if NEXT_PUBLIC_NETWORK_PASSPHRASE uses testnet passphrase in production', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = {
        ...parseEnvFile(PROD_EXAMPLE_FILE, root),
        NEXT_PUBLIC_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
      };

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(false);
      const err = report.errors.find((e) => e.key === 'NEXT_PUBLIC_NETWORK_PASSPHRASE');
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/Production cannot use testnet passphrase/);
    });

    it('should fail if NEXT_PUBLIC_RPC_URL points to testnet or localhost', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = {
        ...parseEnvFile(PROD_EXAMPLE_FILE, root),
        NEXT_PUBLIC_RPC_URL: 'https://soroban-testnet.stellar.org',
      };

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(false);
      const err = report.errors.find((e) => e.key === 'NEXT_PUBLIC_RPC_URL');
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/Production cannot use testnet RPC URL/);
    });

    it('should fail if NEXT_PUBLIC_CONTRACT_ID matches testnet contract ID in production', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = {
        ...parseEnvFile(PROD_EXAMPLE_FILE, root),
        NEXT_PUBLIC_CONTRACT_ID: testnetEnv.NEXT_PUBLIC_CONTRACT_ID,
      };

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(false);
      const err = report.errors.find((e) => e.key === 'NEXT_PUBLIC_CONTRACT_ID');
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/Production contract ID cannot match testnet contract ID/);
    });

    it('should fail if NEXT_PUBLIC_CONTRACT_ID has invalid Stellar address format', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = {
        ...parseEnvFile(PROD_EXAMPLE_FILE, root),
        NEXT_PUBLIC_CONTRACT_ID: 'INVALID_CONTRACT_ID',
      };

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(false);
      const err = report.errors.find((e) => e.key === 'NEXT_PUBLIC_CONTRACT_ID');
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/Invalid Stellar contract ID format/);
    });

    it('should fail if NEXT_PUBLIC_CONTRACT_VERSION starts with testnet: in production', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = {
        ...parseEnvFile(PROD_EXAMPLE_FILE, root),
        NEXT_PUBLIC_CONTRACT_VERSION: 'testnet:CD3TE3IA',
      };

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(false);
      const err = report.errors.find((e) => e.key === 'NEXT_PUBLIC_CONTRACT_VERSION');
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/Production contract version cannot start with 'testnet:'/);
    });

    it('should fail if NEXT_PUBLIC_INDEXER_WS_URL uses localhost in production', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = {
        ...parseEnvFile(PROD_EXAMPLE_FILE, root),
        NEXT_PUBLIC_INDEXER_WS_URL: 'ws://localhost:8080/ws',
      };

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(false);
      const err = report.errors.find((e) => e.key === 'NEXT_PUBLIC_INDEXER_WS_URL');
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/cannot point to localhost/);
    });
  });

  describe('MUST_MATCH Invariant Violations', () => {
    it('should fail if NEXT_PUBLIC_TESTNET_XLM_TOKEN_ID is modified from native-xlm', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = {
        ...parseEnvFile(PROD_EXAMPLE_FILE, root),
        NEXT_PUBLIC_TESTNET_XLM_TOKEN_ID: 'custom-xlm-token',
      };

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(false);
      const err = report.errors.find((e) => e.key === 'NEXT_PUBLIC_TESTNET_XLM_TOKEN_ID');
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/Expected invariant value 'native-xlm'/);
    });

    it('should fail if NEXT_PUBLIC_NFT_METADATA_METHOD is modified from token_uri', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = {
        ...parseEnvFile(PROD_EXAMPLE_FILE, root),
        NEXT_PUBLIC_NFT_METADATA_METHOD: 'get_metadata',
      };

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(false);
      const err = report.errors.find((e) => e.key === 'NEXT_PUBLIC_NFT_METADATA_METHOD');
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/Expected invariant value 'token_uri'/);
    });
  });

  describe('FORBIDDEN_IN_PROD Security Restrictions', () => {
    it('should fail if NEXT_PUBLIC_API_MOCKING is set to enabled in production', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = {
        ...parseEnvFile(PROD_EXAMPLE_FILE, root),
        NEXT_PUBLIC_API_MOCKING: 'enabled',
      };

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      expect(report.success).toBe(false);
      const err = report.errors.find((e) => e.key === 'NEXT_PUBLIC_API_MOCKING');
      expect(err).toBeDefined();
      expect(err?.type).toBe('FORBIDDEN_VALUE_IN_PROD');
      expect(err?.message).toMatch(/MSW API mocking must NEVER be enabled in production/);
    });

    it('should pass when NEXT_PUBLIC_API_MOCKING is disabled', () => {
      const testnetEnv = parseEnvFile(EXAMPLE_FILE, root);
      const prodEnv = {
        ...parseEnvFile(PROD_EXAMPLE_FILE, root),
        NEXT_PUBLIC_API_MOCKING: 'disabled',
      };

      const report = detectConfigurationDrift(testnetEnv, prodEnv);

      const err = report.errors.find((e) => e.key === 'NEXT_PUBLIC_API_MOCKING');
      expect(err).toBeUndefined();
    });
  });
});
