#!/usr/bin/env node
/**
 * Per-route production bundle budget for the governance routes (Issue #1152).
 *
 * `scripts/measure-bundle-size.mjs` / `docs/bundle-size.md` already gate the
 * *aggregate* `.next/static` output at 6.5 MB. That budget is too coarse to
 * catch a regression isolated to one route group: a 200 KB regression in
 * `/governance` is a 3% move against the 6.5 MB aggregate budget (easy to
 * miss) but a potentially large regression in what a governance-page visitor
 * actually downloads.
 *
 * This script reads Next.js's App Router build manifest
 * (`.next/app-build-manifest.json`), sums the JS chunks Next attributes to
 * each governance route, and fails if that sum exceeds the per-route budget.
 *
 * Usage:
 *   pnpm run build
 *   node scripts/check-route-bundle-size.mjs            # prints sizes and verdict
 *   node scripts/check-route-bundle-size.mjs --json      # machine-readable output
 *
 * Exit codes: 0 = every route within budget, 1 = a route exceeded its
 * budget, or the build manifest is missing (run `pnpm run build` first).
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Keep in sync with any change to app/governance/**. Raise only with the
// same "measure the baseline, call out the regression" discipline as
// docs/bundle-size.md's absolute budget.
const ROUTE_BUDGETS_BYTES = {
  '/governance': 400 * 1024,
  '/governance/[id]': 400 * 1024,
  '/governance/new': 400 * 1024,
  '/governance/how-it-works': 300 * 1024,
};

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const buildDir = args.find((arg) => !arg.startsWith('--')) ?? '.next';

const manifestPath = join(process.cwd(), buildDir, 'app-build-manifest.json');

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (err) {
  console.error(
    `Could not read ${manifestPath}. Run \`pnpm run build\` first.\n(${err.message})`
  );
  process.exit(1);
}

// app-build-manifest.json keys routes by their app-dir file path, e.g.
// "/governance/page" or "/governance/[id]/page" -- normalize to the route
// path used in ROUTE_BUDGETS_BYTES.
function routeKeyToPath(key) {
  return key.replace(/\/page$/, '') || '/';
}

const staticRoot = join(process.cwd(), buildDir, 'static');

function fileSize(relativePath) {
  // Manifest paths are relative to .next/, e.g. "static/chunks/app/governance/page-abc123.js".
  try {
    return statSync(join(process.cwd(), buildDir, relativePath)).size;
  } catch {
    return 0;
  }
}

const results = [];
let anyOverBudget = false;

for (const [routePath, budgetBytes] of Object.entries(ROUTE_BUDGETS_BYTES)) {
  const manifestKey = Object.keys(manifest.pages ?? {}).find(
    (key) => routeKeyToPath(key) === routePath
  );

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

  const files = manifest.pages[manifestKey].filter((f) => f.endsWith('.js'));
  const bytes = files.reduce((sum, f) => sum + fileSize(f), 0);
  const withinBudget = bytes <= budgetBytes;
  if (!withinBudget) anyOverBudget = true;

  results.push({ route: routePath, found: true, bytes, budgetBytes, withinBudget, files });
}

const kb = (bytes) => (bytes / 1024).toFixed(1);

if (asJson) {
  console.log(JSON.stringify({ results, within_budget: !anyOverBudget }, null, 2));
} else {
  console.log('📦 Governance route bundle budget (CI-parity: app-build-manifest.json JS chunks)');
  for (const r of results) {
    if (!r.found) {
      console.log(`${r.route}: not found in this build (route renamed or removed?)`);
      continue;
    }
    const verdict = r.withinBudget ? '✅' : '❌';
    console.log(`${verdict} ${r.route}: ${kb(r.bytes)} KB (budget ${kb(r.budgetBytes)} KB)`);
  }
  console.log(
    anyOverBudget
      ? '\n❌ One or more governance routes exceeded their bundle budget.'
      : '\n✅ Every governance route is within its bundle budget.'
  );
}

process.exit(anyOverBudget ? 1 : 0);
