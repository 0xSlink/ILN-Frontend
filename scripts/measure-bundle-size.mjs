#!/usr/bin/env node
/**
 * Cumulative bundle-size measurement for issue #120.
 *
 * Replicates the measurement step of .github/workflows/bundle-size.yml exactly
 * (sum of .next/static/chunks/**/*.js + .next/static/css/**/*.css) so a local
 * run can be compared 1:1 with the CI "Bundle Size Report" against the 6.5 MB
 * budget documented in docs/bundle-size.md.
 *
 * Usage:
 *   node scripts/measure-bundle-size.mjs            # prints sizes and verdict
 *   node scripts/measure-bundle-size.mjs --json     # machine-readable output
 *
 * Exit codes: 0 = within budget, 1 = budget exceeded or build output missing.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUDGET_BYTES = 6_815_744; // 6.5 MB — keep in sync with docs/bundle-size.md

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const rootArg = args.find((arg) => !arg.startsWith('--'));
const nextStaticDir = join(process.cwd(), rootArg ?? '.next', 'static');

function sumFiles(dir, extensions) {
  let total = 0;
  let files = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return { total, files };
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = sumFiles(fullPath, extensions);
      total += nested.total;
      files += nested.files;
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      total += statSync(fullPath).size;
      files += 1;
    }
  }
  return { total, files };
}

const kb = (bytes) => (bytes / 1024).toFixed(1);
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);

const js = sumFiles(join(nextStaticDir, 'chunks'), ['.js']);
const css = sumFiles(join(nextStaticDir, 'css'), ['.css']);
const total = js.total + css.total;

const result = {
  js_bytes: js.total,
  js_files: js.files,
  css_bytes: css.total,
  css_files: css.files,
  total_bytes: total,
  budget_bytes: BUDGET_BYTES,
  within_budget: total <= BUDGET_BYTES,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('📦 Bundle Size Report (CI-parity: .next/static/chunks/**/*.js + css)');
  console.log(`JavaScript chunks : ${kb(js.total)} KB (${js.files} files)`);
  console.log(`CSS               : ${kb(css.total)} KB (${css.files} files)`);
  console.log(`Total             : ${kb(total)} KB (${mb(total)} MB)`);
  console.log(`Budget            : ${kb(BUDGET_BYTES)} KB (${mb(BUDGET_BYTES)} MB)`);
  console.log(
    result.within_budget
      ? '✅ Within budget — total bundle is under the 6.5 MB threshold.'
      : '❌ Budget exceeded — total bundle is over the 6.5 MB threshold.'
  );
}

if (total === 0) {
  console.error(
    '\nNo .next/static output found. Run `pnpm run build` first (with NEXT_PUBLIC_STELLAR_NETWORK=testnet to match CI).'
  );
  process.exit(1);
}

process.exit(result.within_budget ? 0 : 1);
