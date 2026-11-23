/* eslint-disable no-console */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = process.cwd();
export const SOURCE_DIRS = ['app', 'src'];
export const EXAMPLE_FILE = '.env.local.example';
export const PROD_EXAMPLE_FILE = '.env.production.example';
export const ALLOWLIST_FILE = '.env.local.example.allowlist';
export const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

/**
 * Expected difference specification between Testnet and Mainnet (Production) environments.
 * Defines which variables MUST differ, which MUST match (invariants), and security restrictions.
 */
export const CONFIG_DIFF_SPEC = {
  // Environment variables that MUST differ between testnet and mainnet
  mustDiffer: {
    NEXT_PUBLIC_STELLAR_NETWORK: {
      description:
        "Stellar network identifier (must be 'public' on mainnet, never 'mainnet' or 'testnet')",
      validateProd: (val, testnetVal) => {
        if (!val) return 'Missing production value';
        if (val === testnetVal) return `Must differ from testnet value (${testnetVal})`;
        if (val === 'mainnet') {
          return "Must be 'public' (not 'mainnet' - see naming note in docs/mainnet-deployment-runbook.md)";
        }
        if (val !== 'public') {
          return `Expected 'public' on mainnet, received '${val}'`;
        }
        return null;
      },
    },
    NEXT_PUBLIC_NETWORK_NAME: {
      description: 'Human-readable network identifier',
      validateProd: (val, testnetVal) => {
        if (!val) return 'Missing production value';
        if (val === testnetVal) return `Must differ from testnet value (${testnetVal})`;
        if (val !== 'PUBLIC' && val !== 'MAINNET') {
          return `Expected 'PUBLIC' or 'MAINNET', received '${val}'`;
        }
        return null;
      },
    },
    NEXT_PUBLIC_NETWORK_PASSPHRASE: {
      description: 'Stellar network passphrase',
      validateProd: (val, testnetVal) => {
        if (!val) return 'Missing production value';
        if (val === testnetVal) return 'Production cannot use testnet passphrase';
        const expected = 'Public Global Stellar Network ; September 2015';
        if (val !== expected) {
          return `Passphrase does not match SDF public network passphrase. Expected '${expected}'`;
        }
        return null;
      },
    },
    NEXT_PUBLIC_RPC_URL: {
      description: 'Mainnet Soroban RPC endpoint',
      validateProd: (val, testnetVal) => {
        if (!val) return 'Missing production value';
        if (val === testnetVal) return 'Production cannot use testnet RPC URL';
        if (/testnet|futurenet|localhost|127\.0\.0\.1/i.test(val)) {
          return `Production RPC endpoint cannot point to testnet, futurenet, or localhost ('${val}')`;
        }
        if (!val.startsWith('https://')) {
          return `Production RPC endpoint must use HTTPS ('${val}')`;
        }
        return null;
      },
    },
    NEXT_PUBLIC_CONTRACT_ID: {
      description: 'Mainnet invoice factoring contract ID',
      validateProd: (val, testnetVal) => {
        if (!val) return 'Missing production contract ID';
        if (val === testnetVal)
          return `Production contract ID cannot match testnet contract ID (${testnetVal})`;
        if (!/^C[A-Z0-9]{55}$/.test(val)) {
          return `Invalid Stellar contract ID format (must be 56 uppercase alphanumeric characters starting with C, received: '${val}')`;
        }
        return null;
      },
    },
    NEXT_PUBLIC_TESTNET_USDC_TOKEN_ID: {
      description: 'Mainnet USDC token contract address',
      validateProd: (val, testnetVal) => {
        if (!val) return 'Missing production USDC token contract ID';
        if (val === testnetVal) return 'Production USDC token ID cannot match testnet USDC ID';
        return null;
      },
    },
    NEXT_PUBLIC_TESTNET_EURC_TOKEN_ID: {
      description: 'Mainnet EURC token contract address',
      validateProd: (val, testnetVal) => {
        if (!val) return 'Missing production EURC token contract ID';
        if (val === testnetVal) return 'Production EURC token ID cannot match testnet EURC ID';
        return null;
      },
    },
    NEXT_PUBLIC_CONTRACT_VERSION: {
      description: 'Contract version identifier',
      validateProd: (val, testnetVal) => {
        if (!val) return 'Missing production contract version';
        if (val === testnetVal)
          return `Production contract version cannot match testnet version (${testnetVal})`;
        if (val.startsWith('testnet:')) {
          return `Production contract version cannot start with 'testnet:' ('${val}')`;
        }
        return null;
      },
    },
    NEXT_PUBLIC_INDEXER_WS_URL: {
      description: 'Mainnet indexer WebSocket endpoint',
      validateProd: (val, testnetVal) => {
        if (!val) return 'Missing production indexer WS URL';
        if (val === testnetVal || /localhost|127\.0\.0\.1/.test(val)) {
          return `Production indexer WebSocket URL cannot point to localhost or testnet default ('${val}')`;
        }
        if (!val.startsWith('wss://') && !val.startsWith('ws://')) {
          return `Invalid WebSocket URL scheme ('${val}')`;
        }
        return null;
      },
    },
    NEXT_PUBLIC_APP_VERSION: {
      description: 'Public app version label',
      validateProd: (val, _testnetVal) => {
        if (val === 'dev') {
          return "Production app version should not be 'dev'";
        }
        return null;
      },
    },
    NEXT_PUBLIC_GOVERNANCE_ADMIN_ADDRESS: {
      description: 'Governance admin public key',
      validateProd: (val, _testnetVal) => {
        if (val && val === 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF') {
          return 'Production governance admin address cannot use dummy default testnet public key';
        }
        return null;
      },
    },
    NEXT_PUBLIC_INDEXER_API_URL: {
      description: 'Mainnet indexer API endpoint',
      validateProd: (val, testnetVal) => {
        if (!val) return 'Missing production indexer API URL';
        if (val === testnetVal || /localhost|127\.0\.0\.1/.test(val)) {
          return `Production indexer API URL cannot point to localhost or testnet default ('${val}')`;
        }
        if (!val.startsWith('https://')) {
          return `Production indexer API URL must use HTTPS ('${val}')`;
        }
        return null;
      },
    },
    INDEXER_URL: {
      description: 'Production server-side indexer URL',
      validateProd: (val, testnetVal) => {
        if (!val) return 'Missing production indexer server URL';
        if (val === testnetVal || /localhost|127\.0\.0\.1/.test(val)) {
          return `Production indexer server URL cannot point to localhost or testnet default ('${val}')`;
        }
        if (!val.startsWith('https://')) {
          return `Production indexer server URL must use HTTPS ('${val}')`;
        }
        return null;
      },
    },
    NEXT_PUBLIC_SEP10_WEB_AUTH_ENDPOINT: {
      description: 'Production SEP-10 Web Auth endpoint',
      validateProd: (val, testnetVal) => {
        if (!val) return 'Missing production SEP-10 Web Auth endpoint';
        if (val === testnetVal || /localhost|127\.0\.0\.1|example\.com/i.test(val)) {
          return `Production SEP-10 endpoint cannot point to testnet/example domain ('${val}')`;
        }
        if (!val.startsWith('https://')) {
          return `Production SEP-10 endpoint must use HTTPS ('${val}')`;
        }
        return null;
      },
    },
    NEXT_PUBLIC_SEP10_HOME_DOMAIN: {
      description: 'Production SEP-10 public home domain',
      validateProd: (val) => {
        if (!val) return 'Missing production SEP-10 public home domain';
        if (/localhost|example\.com/i.test(val)) {
          return `Production SEP-10 home domain cannot use example or localhost domain ('${val}')`;
        }
        return null;
      },
    },
    SEP10_HOME_DOMAIN: {
      description: 'Production SEP-10 server home domain',
      validateProd: (val) => {
        if (!val) return 'Missing production SEP-10 server home domain';
        if (/localhost|example\.com/i.test(val)) {
          return `Production SEP-10 home domain cannot use example or localhost domain ('${val}')`;
        }
        return null;
      },
    },
  },

  // Environment variables that MUST be identical / network-agnostic invariants
  mustMatch: {
    NEXT_PUBLIC_TESTNET_XLM_TOKEN_ID: {
      expected: 'native-xlm',
      description: 'Native XLM asset identifier is network-agnostic',
    },
    NEXT_PUBLIC_NFT_METADATA_METHOD: {
      expected: 'token_uri',
      description: 'Soroban NFT contract method interface name',
    },
  },

  // Security restrictions and forbidden values in production
  forbiddenInProd: {
    NEXT_PUBLIC_API_MOCKING: {
      forbiddenValues: ['enabled', 'true', '1'],
      description: 'MSW API mocking must NEVER be enabled in production',
    },
  },

  // Placeholder secrets that must never appear in real production deployments
  dummyPlaceholders: [
    'https://your-project.supabase.co',
    'your-anon-key',
    'your-service-role-key',
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  ],
};

/**
 * Required domain specifications for Indexer, RPC, Wallet, and Authentication.
 * Fails closed if any required variable is missing, empty, or misconfigured.
 */
export const REQUIRED_DOMAIN_VARIABLES = {
  indexer: {
    name: 'Indexer',
    required: ['INDEXER_URL', 'NEXT_PUBLIC_INDEXER_WS_URL', 'NEXT_PUBLIC_INDEXER_API_URL'],
    validate: (key, val, isProd) => {
      if (val === undefined || (isProd && !val.trim())) {
        return `Required indexer variable '${key}' is missing or empty`;
      }
      if (isProd) {
        if (/localhost|127\.0\.0\.1/.test(val)) {
          return `Production indexer variable '${key}' cannot point to localhost ('${val}')`;
        }
        if (key.includes('URL') && !key.includes('WS') && !val.startsWith('https://')) {
          return `Production indexer URL '${key}' must use HTTPS ('${val}')`;
        }
        if (key.includes('WS') && !val.startsWith('wss://')) {
          return `Production indexer WebSocket URL '${key}' must use WSS ('${val}')`;
        }
      }
      return null;
    },
  },
  rpc: {
    name: 'RPC & Stellar Protocol',
    required: [
      'NEXT_PUBLIC_RPC_URL',
      'NEXT_PUBLIC_CONTRACT_ID',
      'NEXT_PUBLIC_NETWORK_PASSPHRASE',
      'NEXT_PUBLIC_STELLAR_NETWORK',
      'NEXT_PUBLIC_NETWORK_NAME',
    ],
    validate: (key, val, isProd) => {
      if (val === undefined || (isProd && !val.trim())) {
        return `Required RPC variable '${key}' is missing or empty`;
      }
      if (isProd) {
        if (key === 'NEXT_PUBLIC_RPC_URL') {
          if (!val.startsWith('https://'))
            return `Production RPC endpoint must use HTTPS ('${val}')`;
          if (/testnet|futurenet|localhost|127\.0\.0\.1/i.test(val)) {
            return `Production RPC endpoint cannot point to testnet, futurenet, or localhost ('${val}')`;
          }
        }
        if (key === 'NEXT_PUBLIC_CONTRACT_ID' && !/^C[A-Z0-9]{55}$/.test(val)) {
          return `Production contract ID must be 56 uppercase alphanumeric chars starting with C ('${val}')`;
        }
        if (key === 'NEXT_PUBLIC_STELLAR_NETWORK' && val !== 'public') {
          return `Production Stellar network must be 'public' ('${val}')`;
        }
        if (
          key === 'NEXT_PUBLIC_NETWORK_PASSPHRASE' &&
          val !== 'Public Global Stellar Network ; September 2015'
        ) {
          return `Production passphrase does not match SDF public network passphrase`;
        }
      }
      return null;
    },
  },
  wallet: {
    name: 'Wallet',
    required: ['NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID'],
    validate: (key, val, isProd, strictSecrets) => {
      if (val === undefined) return `Required wallet variable '${key}' is not documented`;
      if (isProd && !val.trim()) {
        return `Production wallet variable '${key}' cannot be empty`;
      }
      if (isProd && strictSecrets && (!val || val.includes('placeholder'))) {
        return `Production wallet variable '${key}' must be configured (found placeholder or empty)`;
      }
      return null;
    },
  },
  authentication: {
    name: 'Authentication (SEP-10 / JWT)',
    required: [
      'SEP10_SERVER_SECRET_KEY',
      'SEP10_HOME_DOMAIN',
      'JWT_SECRET_KEY',
      'NEXT_PUBLIC_SEP10_HOME_DOMAIN',
      'NEXT_PUBLIC_SEP10_WEB_AUTH_ENDPOINT',
    ],
    validate: (key, val, isProd, strictSecrets) => {
      if (val === undefined) return `Required authentication variable '${key}' is not documented`;
      if (isProd) {
        if (!val.trim()) {
          return `Production authentication variable '${key}' cannot be empty`;
        }
        if (strictSecrets && (!val || val.includes('placeholder'))) {
          return `Production authentication secret '${key}' is missing or unconfigured placeholder`;
        }
        if (key === 'NEXT_PUBLIC_SEP10_WEB_AUTH_ENDPOINT' && !val.startsWith('https://')) {
          return `Production SEP-10 Web Auth endpoint must use HTTPS ('${val}')`;
        }
        if (key.includes('HOME_DOMAIN') && /example\.com|localhost/i.test(val)) {
          return `Production SEP-10 domain '${key}' cannot use example or localhost domain ('${val}')`;
        }
      }
      return null;
    },
  },
};

/**
 * Validates that all required indexer, RPC, wallet, and authentication variables
 * are documented and fail closed.
 */
export function verifyDomainRequirements(env, options = {}) {
  const isProduction = Boolean(options.isProduction);
  const strictSecrets = Boolean(options.strictSecrets);
  const errors = [];
  const passed = [];

  for (const [domainKey, domain] of Object.entries(REQUIRED_DOMAIN_VARIABLES)) {
    for (const varName of domain.required) {
      const val = env[varName];
      const validationError = domain.validate(varName, val, isProduction, strictSecrets);
      if (validationError) {
        errors.push({
          domain: domainKey,
          domainName: domain.name,
          key: varName,
          message: validationError,
        });
      } else {
        passed.push({
          domain: domainKey,
          domainName: domain.name,
          key: varName,
        });
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
    passed,
  };
}

/**
 * Walk directory recursively to find source files
 */
export function walk(dir, root = ROOT) {
  const absolute = path.join(root, dir);
  let entries;
  try {
    entries = readdirSync(absolute);
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const fullPath = path.join(absolute, entry);
    const relativePath = path.relative(root, fullPath);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return walk(relativePath, root);
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(entry))) {
      return [];
    }

    return [relativePath];
  });
}

/**
 * Parse an env file into a key-value Record
 */
export function parseEnvFile(filePath, root = ROOT) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  let content;
  try {
    content = readFileSync(fullPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Environment file not found: ${filePath}`);
    }
    throw error;
  }

  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1];
      let val = match[2].trim();
      // Remove surrounding single or double quotes if present
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

/**
 * Read allowlisted env vars
 */
export function readAllowlist(allowlistFile = ALLOWLIST_FILE, root = ROOT) {
  let content;
  try {
    content = readFileSync(path.join(root, allowlistFile), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }

  return new Set(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
  );
}

/**
 * Scan source directories for direct process.env and import.meta.env references
 */
export function readReferencedEnvNames(sourceDirs = SOURCE_DIRS, root = ROOT) {
  const names = new Set();
  const directEnvReference =
    /(?:process|import\.meta)\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\])/g;

  for (const file of sourceDirs.flatMap((dir) => walk(dir, root))) {
    const content = readFileSync(path.join(root, file), 'utf8');
    for (const match of content.matchAll(directEnvReference)) {
      names.add(match[1] ?? match[2]);
    }
  }

  return names;
}

/**
 * Validate that .env.local.example covers all env vars referenced by the codebase
 */
export function checkEnvExampleSync(options = {}) {
  const root = options.root || ROOT;
  const exampleFile = options.exampleFile || EXAMPLE_FILE;
  const allowlistFile = options.allowlistFile || ALLOWLIST_FILE;
  const sourceDirs = options.sourceDirs || SOURCE_DIRS;

  const documentedMap = parseEnvFile(exampleFile, root);
  const documented = new Set(Object.keys(documentedMap));
  const allowlisted = readAllowlist(allowlistFile, root);
  const referenced = readReferencedEnvNames(sourceDirs, root);

  const missing = [...referenced]
    .filter((name) => !documented.has(name) && !allowlisted.has(name))
    .sort();

  const domainCheck = verifyDomainRequirements(documentedMap, { isProduction: false });

  return {
    success: missing.length === 0 && domainCheck.success,
    missing,
    domainErrors: domainCheck.errors,
    documentedCount: documented.size,
    referencedCount: referenced.size,
  };
}

/**
 * Mask sensitive values for display
 */
export function maskValue(key, val) {
  if (!val) return '<empty>';
  const isSecret =
    !key.startsWith('NEXT_PUBLIC_') ||
    key.includes('KEY') ||
    key.includes('SECRET') ||
    key.includes('TOKEN');
  if (isSecret) {
    if (val.length <= 8) return '********';
    return `${val.slice(0, 4)}...${val.slice(-4)}`;
  }
  return val;
}

/**
 * Compare testnet and mainnet (production) configuration sets and check for drift
 */
export function detectConfigurationDrift(
  testnetEnv,
  prodEnv,
  spec = CONFIG_DIFF_SPEC,
  options = {}
) {
  const errors = [];
  const warnings = [];
  const passed = [];

  const testnetKeys = new Set(Object.keys(testnetEnv));
  const prodKeys = new Set(Object.keys(prodEnv));

  // 1. Check Schema Parity: Ensure all testnet keys are present in production snapshot
  for (const key of testnetKeys) {
    if (!prodKeys.has(key)) {
      errors.push({
        key,
        type: 'MISSING_IN_PROD',
        message: `Variable '${key}' is defined in testnet example but missing in production snapshot`,
      });
    }
  }

  // 2. Validate MUST_DIFFER rules
  for (const [key, rule] of Object.entries(spec.mustDiffer)) {
    const testnetVal = testnetEnv[key] ?? '';
    const prodVal = prodEnv[key] ?? '';

    const validationError = rule.validateProd(prodVal, testnetVal);
    if (validationError) {
      errors.push({
        key,
        type: 'MUST_DIFFER_VIOLATION',
        message: validationError,
        testnetValue: maskValue(key, testnetVal),
        prodValue: maskValue(key, prodVal),
        description: rule.description,
      });
    } else {
      passed.push({
        key,
        type: 'MUST_DIFFER_PASSED',
        message: `Correctly differs between testnet and mainnet (${rule.description})`,
        testnetValue: maskValue(key, testnetVal),
        prodValue: maskValue(key, prodVal),
      });
    }
  }

  // 3. Validate MUST_MATCH rules
  for (const [key, rule] of Object.entries(spec.mustMatch)) {
    const prodVal = prodEnv[key];
    const testnetVal = testnetEnv[key];

    if (prodVal === undefined) {
      errors.push({
        key,
        type: 'MISSING_IN_PROD',
        message: `Required invariant '${key}' missing in production`,
      });
      continue;
    }

    if (rule.expected && prodVal !== rule.expected) {
      errors.push({
        key,
        type: 'INVARIANT_VIOLATION',
        message: `Expected invariant value '${rule.expected}', received '${prodVal}'`,
        description: rule.description,
      });
    } else if (testnetVal !== undefined && prodVal !== testnetVal) {
      errors.push({
        key,
        type: 'INVARIANT_VIOLATION',
        message: `Expected production value to match testnet invariant ('${testnetVal}'), received '${prodVal}'`,
        description: rule.description,
      });
    } else {
      passed.push({
        key,
        type: 'INVARIANT_PASSED',
        message: `Invariant verified (${rule.description})`,
        prodValue: maskValue(key, prodVal),
      });
    }
  }

  // 4. Validate FORBIDDEN_IN_PROD rules
  for (const [key, rule] of Object.entries(spec.forbiddenInProd)) {
    const prodVal = prodEnv[key];
    if (prodVal && rule.forbiddenValues.includes(prodVal.toLowerCase())) {
      errors.push({
        key,
        type: 'FORBIDDEN_VALUE_IN_PROD',
        message: `Value '${prodVal}' is forbidden in production. ${rule.description}`,
      });
    } else if (prodVal) {
      passed.push({
        key,
        type: 'FORBIDDEN_RULE_PASSED',
        message: `Safe production value '${prodVal}' (${rule.description})`,
      });
    }
  }

  // 5. Check Secret Hygiene
  for (const [key, val] of Object.entries(prodEnv)) {
    if (!key.startsWith('NEXT_PUBLIC_') && val) {
      // Server-only secret
      if (spec.dummyPlaceholders.includes(val)) {
        warnings.push({
          key,
          type: 'DUMMY_PLACEHOLDER_WARNING',
          message: `Secret contains a known placeholder value ('${val}')`,
        });
      }
    }
  }

  // 6. Fail-closed verification of required Indexer, RPC, Wallet, and Authentication domains
  const domainValidation = verifyDomainRequirements(prodEnv, {
    isProduction: true,
    strictSecrets: Boolean(options.strictSecrets),
  });

  for (const err of domainValidation.errors) {
    errors.push({
      key: err.key,
      type: 'DOMAIN_REQUIREMENT_VIOLATION',
      message: `[${err.domainName}] ${err.message}`,
    });
  }
  for (const p of domainValidation.passed) {
    passed.push({
      key: p.key,
      type: 'DOMAIN_REQUIREMENT_PASSED',
      message: `Verified required ${p.domainName} variable fail-closed invariant`,
    });
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    passed,
  };
}

/**
 * Fetch environment variables from Vercel API if credentials are available
 */
export async function fetchVercelProductionEnv(token, projectId, teamId) {
  if (!token || !projectId) {
    throw new Error('VERCEL_TOKEN and VERCEL_PROJECT_ID are required to fetch from Vercel API');
  }

  const url = new URL(`https://api.vercel.com/v9/projects/${projectId}/env`);
  url.searchParams.set('target', 'production');
  if (teamId) {
    url.searchParams.set('teamId', teamId);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Vercel API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const envMap = {};

  if (Array.isArray(data.envs)) {
    for (const item of data.envs) {
      if (item.target && item.target.includes('production')) {
        envMap[item.key] = item.value || '';
      }
    }
  }

  return envMap;
}

/**
 * Main CLI runner
 */
async function main() {
  const args = process.argv.slice(2);
  const isDriftCheck =
    args.includes('--drift') ||
    args.includes('--drift-check') ||
    process.env.CHECK_CONFIG_DRIFT === 'true';
  const isJson = args.includes('--json');
  const useVercel = args.includes('--vercel');

  // If running standard reference check (pnpm run env:check)
  if (!isDriftCheck) {
    const { success, missing } = checkEnvExampleSync();
    if (!success) {
      console.error(`${EXAMPLE_FILE} is missing env vars referenced by app/ or src/:`);
      for (const name of missing) {
        console.error(`- ${name}`);
      }
      console.error(
        `\nAdd public/config vars to ${EXAMPLE_FILE} or runtime-only exceptions to ${ALLOWLIST_FILE}.`
      );
      process.exit(1);
    }
    console.log(`${EXAMPLE_FILE} covers all direct app/ and src/ env references.`);
    return;
  }

  // Running drift check (pnpm run env:drift-check)
  console.log('🔍 Running Mainnet vs. Testnet Configuration Drift Detection...\n');

  let testnetEnv;
  let prodEnv;

  try {
    testnetEnv = parseEnvFile(EXAMPLE_FILE);
  } catch (err) {
    console.error(`❌ Failed to read testnet example file (${EXAMPLE_FILE}):`, err.message);
    process.exit(1);
  }

  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelProjectId = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_GIT_REPO_ID;
  const vercelTeamId = process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID;

  if (useVercel && vercelToken && vercelProjectId) {
    console.log('🌐 Fetching live production environment variables from Vercel API...');
    try {
      prodEnv = await fetchVercelProductionEnv(vercelToken, vercelProjectId, vercelTeamId);
      console.log(
        `✅ Loaded ${Object.keys(prodEnv).length} production variables from Vercel API\n`
      );
    } catch (err) {
      console.warn(
        `⚠️ Vercel API fetch failed: ${err.message}. Falling back to ${PROD_EXAMPLE_FILE}\n`
      );
      prodEnv = parseEnvFile(PROD_EXAMPLE_FILE);
    }
  } else {
    try {
      prodEnv = parseEnvFile(PROD_EXAMPLE_FILE);
      console.log(`📄 Comparing against checked-in production snapshot: ${PROD_EXAMPLE_FILE}\n`);
    } catch (err) {
      console.error(
        `❌ Failed to read production snapshot file (${PROD_EXAMPLE_FILE}):`,
        err.message
      );
      process.exit(1);
    }
  }

  const report = detectConfigurationDrift(testnetEnv, prodEnv);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.success ? 0 : 1);
  }

  // Print formatted report
  console.log('=== Configuration Drift Analysis Report ===\n');

  console.log(`✅ Passed Checks (${report.passed.length}):`);
  for (const item of report.passed) {
    console.log(`  ✓ ${item.key}: ${item.message}`);
    if (item.prodValue) {
      console.log(`    (testnet: ${item.testnetValue || '-'} | prod: ${item.prodValue})`);
    }
  }
  console.log();

  if (report.warnings.length > 0) {
    console.log(`⚠️  Warnings (${report.warnings.length}):`);
    for (const item of report.warnings) {
      console.log(`  ! ${item.key}: ${item.message}`);
    }
    console.log();
  }

  if (report.errors.length > 0) {
    console.error(`❌ Drift Violations Detected (${report.errors.length}):`);
    for (const item of report.errors) {
      console.error(`  ✗ [${item.type}] ${item.key}: ${item.message}`);
      if (item.testnetValue !== undefined && item.prodValue !== undefined) {
        console.error(`    - Testnet: ${item.testnetValue}`);
        console.error(`    - Mainnet: ${item.prodValue}`);
      }
    }
    console.error(
      '\n🚨 Configuration drift check FAILED. Prevented shipping testnet-convenience values to mainnet.'
    );
    console.error(
      'Review docs/mainnet-deployment-runbook.md for the required mainnet diff specification.\n'
    );
    process.exit(1);
  }

  console.log('✨ Configuration drift check PASSED. No testnet convenience leaks detected.\n');
}

// Execute main if run directly
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    console.error('Fatal error running environment check:', err);
    process.exit(1);
  });
}
