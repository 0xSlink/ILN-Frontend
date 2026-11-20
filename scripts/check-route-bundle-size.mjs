#!/usr/bin/env node
/* eslint-disable no-console -- CLI script: human-readable and --json stdout output is its interface. */
/**
 * Per-route production bundle budget and runtime dependency regression check
 * for governance and financial routes (Issues #1152, #1357).
 *
 * Data sources & source of truth:
 * - `.next/app-build-manifest.json` (Next.js App Router JS chunks per route)
 * - `package.json` (`dependencies` map for browser/runtime dependency audit)
 *
 * Failure behavior:
 * - Exits 1 when `.next/app-build-manifest.json` is missing/unreadable (unless `--deps-only`).
 * - Exits 1 when any budgeted governance or financial route exceeds its byte budget.
 * - Exits 1 when `package.json` `dependencies` introduces an unsafe runtime package
 *   (server-only DB/shell/eval/browser-automation packages) or an unpinned/remote
 *   dependency specifier (`*`, `latest`, `http(s)://`, `git://`, `file:`, `link:`).
 *
 * Usage:
 *   pnpm run build
 *   node scripts/check-route-bundle-size.mjs            # prints sizes, dep audit, and verdict
 *   node scripts/check-route-bundle-size.mjs --json     # machine-readable output
 *   node scripts/check-route-bundle-size.mjs --deps-only
 *
 * Exit codes: 0 = every route within budget and runtime dependencies approved,
 *             1 = route over budget, unsafe dependency detected, or manifest missing.
 */
import { readFileSync, statSync } from 'node:fs';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GOVERNANCE_ROUTE_BUDGETS_BYTES = {
  '/governance': 400 * 1024,
  '/governance/[id]': 400 * 1024,
  '/governance/new': 400 * 1024,
  '/governance/how-it-works': 300 * 1024,
};

export const FINANCIAL_ROUTE_BUDGETS_BYTES = {
  '/submit': 1024 * 1024,
  '/freelancer': 1200 * 1024,
  '/lp': 1200 * 1024,
  '/lp/compare': 1024 * 1024,
  '/payer': 1024 * 1024,
  '/pay/[id]': 1024 * 1024,
  '/i/[id]': 1024 * 1024,
  '/invoices/batch': 1024 * 1024,
  '/marketplace': 1024 * 1024,
  '/dashboard': 1200 * 1024,
  '/stats': 1200 * 1024,
  '/analytics': 1200 * 1024,
  '/tokens': 800 * 1024,
};

export const ROUTE_BUDGETS_BYTES = {
  ...GOVERNANCE_ROUTE_BUDGETS_BYTES,
  ...FINANCIAL_ROUTE_BUDGETS_BYTES,
};

/**
 * Runtime packages disallowed in production `dependencies` because they execute
 * shell commands, evaluate arbitrary code, expose server-only database/secret
 * drivers to client bundles, or bundle heavyweight automation/build runtimes.
 */
export const UNSAFE_RUNTIME_DEPENDENCIES = {
  vm2: 'Deprecated sandbox with known RCE escapes; never bundle in financial apps.',
  'node-serialize': 'Known deserialization RCE risk.',
  eval: 'Arbitrary code execution package.',
  'node-eval': 'Arbitrary code execution package.',
  shelljs: 'Shell execution library must not be in frontend runtime dependencies.',
  execa: 'Process spawning library must not be in frontend runtime dependencies.',
  'child-process-promise': 'Process spawning library must not be in frontend runtime dependencies.',
  puppeteer: 'Headless browser automation belongs only in devDependencies/CI.',
  playwright: 'Browser automation belongs only in devDependencies/CI.',
  '@playwright/test': 'Test runner belongs only in devDependencies.',
  '@babel/standalone': 'Runtime transpiler bloats bundles and relies on dynamic evaluation.',
  pg: 'Direct database driver must not be bundled into frontend runtime dependencies.',
  mysql2: 'Direct database driver must not be bundled into frontend runtime dependencies.',
  mongodb: 'Direct database driver must not be bundled into frontend runtime dependencies.',
  ioredis: 'Direct cache/database driver must not be bundled into frontend runtime dependencies.',
  redis: 'Direct cache/database driver must not be bundled into frontend runtime dependencies.',
  dotenv: 'Environment loader is redundant with Next.js env handling and risks leaking config.',
};

const UNSAFE_SPECIFIER_PATTERNS = [
  { pattern: /^(\*|latest|next)$/i, reason: 'Unpinned wildcard or floating dist-tag specifier.' },
  {
    pattern: /^(https?:|git\+|git:|github:|file:|link:)/i,
    reason: 'Remote URL, git, or local path specifier bypasses registry integrity.',
  },
];

/**
 * Normalizes Next.js app-build-manifest page keys (e.g. "/governance/page")
 * into route paths ("/governance").
 */
export function routeKeyToPath(key) {
  return key.replace(/\/page$/, '') || '/';
}

function getFileSize(cwd, buildDir, relativePath) {
  try {
    return statSync(join(cwd, buildDir, relativePath)).size;
  } catch {
    return 0;
  }
}

/**
 * Evaluates every configured route budget against a parsed Next.js
 * `app-build-manifest.json` object.
 */
export function evaluateRouteBudgets(
  manifest,
  {
    cwd = process.cwd(),
    buildDir = '.next',
    budgets = ROUTE_BUDGETS_BYTES,
    resolveFileSize = (relativePath) => getFileSize(cwd, buildDir, relativePath),
  } = {}
) {
  const results = [];
  let anyOverBudget = false;
  const pages = manifest?.pages ?? {};

  for (const [routePath, budgetBytes] of Object.entries(budgets)) {
    const manifestKey = Object.keys(pages).find((key) => routeKeyToPath(key) === routePath);

    if (!manifestKey) {
      results.push({
        route: routePath,
        found: false,
        bytes: 0,
        budgetBytes,
        withinBudget: true,
      });
      continue;
    }

    const files = pages[manifestKey].filter((f) => f.endsWith('.js'));
    const bytes = files.reduce((sum, f) => sum + resolveFileSize(f), 0);
    const withinBudget = bytes <= budgetBytes;
    if (!withinBudget) anyOverBudget = true;

    results.push({ route: routePath, found: true, bytes, budgetBytes, withinBudget, files });
  }

  return {
    results,
    withinBudget: !anyOverBudget,
  };
}

/**
 * Audits production `dependencies` in package.json for unsafe runtime packages
 * and unpinned/remote version specifiers.
 */
export function auditRuntimeDependencies(packageJson) {
  const dependencies = packageJson?.dependencies ?? {};
  const violations = [];

  for (const [name, version] of Object.entries(dependencies)) {
    if (Object.prototype.hasOwnProperty.call(UNSAFE_RUNTIME_DEPENDENCIES, name)) {
      violations.push({
        package: name,
        version: String(version),
        kind: 'unsafe-package',
        reason: UNSAFE_RUNTIME_DEPENDENCIES[name],
      });
    }

    const spec = String(version ?? '').trim();
    for (const rule of UNSAFE_SPECIFIER_PATTERNS) {
      if (rule.pattern.test(spec)) {
        violations.push({
          package: name,
          version: spec,
          kind: 'unsafe-specifier',
          reason: rule.reason,
        });
      }
    }
  }

  return {
    checkedCount: Object.keys(dependencies).length,
    violations,
    passed: violations.length === 0,
  };
}

export function runBudgetAndDependencyCheck({
  cwd = process.cwd(),
  buildDir = '.next',
  depsOnly = false,
  budgets = ROUTE_BUDGETS_BYTES,
} = {}) {
  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const dependencyAudit = auditRuntimeDependencies(packageJson);

  if (depsOnly) {
    return {
      results: [],
      withinBudget: true,
      dependencyAudit,
      passed: dependencyAudit.passed,
    };
  }

  const manifestPath = join(cwd, buildDir, 'app-build-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const { results, withinBudget } = evaluateRouteBudgets(manifest, { cwd, buildDir, budgets });

  return {
    results,
    withinBudget,
    dependencyAudit,
    passed: withinBudget && dependencyAudit.passed,
  };
}

const kb = (bytes) => (bytes / 1024).toFixed(1);

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const depsOnly = args.includes('--deps-only');
  const buildDir = args.find((arg) => !arg.startsWith('--')) ?? '.next';

  let report;
  try {
    report = runBudgetAndDependencyCheck({ buildDir, depsOnly });
  } catch (err) {
    console.error(
      `Could not complete bundle/dependency check (buildDir=${buildDir}). Run \`pnpm run build\` first.\n(${err.message})`
    );
    process.exit(1);
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          results: report.results,
          within_budget: report.withinBudget,
          dependency_audit: report.dependencyAudit,
          passed: report.passed,
        },
        null,
        2
      )
    );
  } else {
    if (!depsOnly) {
      console.log(
        '📦 Governance & financial route bundle budget (CI-parity: app-build-manifest.json JS chunks)'
      );
      for (const r of report.results) {
        if (!r.found) {
          console.log(`${r.route}: not found in this build (route renamed or removed?)`);
          continue;
        }
        const verdict = r.withinBudget ? '✅' : '❌';
        console.log(`${verdict} ${r.route}: ${kb(r.bytes)} KB (budget ${kb(r.budgetBytes)} KB)`);
      }
      console.log(
        report.withinBudget
          ? '\n✅ Every budgeted route is within its bundle budget.'
          : '\n❌ One or more budgeted routes exceeded their bundle budget.'
      );
    }

    console.log(
      `\n🔒 Runtime dependency audit (${report.dependencyAudit.checkedCount} production dependencies checked)`
    );
    if (report.dependencyAudit.passed) {
      console.log('✅ No unsafe runtime dependencies or unpinned specifiers detected.');
    } else {
      for (const v of report.dependencyAudit.violations) {
        console.log(`❌ ${v.package}@${v.version} [${v.kind}]: ${v.reason}`);
      }
    }
  }

  process.exit(report.passed ? 0 : 1);
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main();
}
