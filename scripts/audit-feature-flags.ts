#!/usr/bin/env node
/**
 * scripts/audit-feature-flags.ts
 *
 * Audits all NEXT_PUBLIC_*_ENABLED feature flags in the codebase.
 * Reports which flags exist, where they are checked, and identifies
 * flags that appear unused, always-on, or always-off.
 *
 * Usage:
 *   pnpm exec tsx scripts/audit-feature-flags.ts
 *   # or from CI:
 *   node --experimental-strip-types scripts/audit-feature-flags.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FlagUsage {
  file: string;
  line: number;
  snippet: string;
}

interface FlagReport {
  name: string;
  /** All source locations where this flag is referenced */
  usages: FlagUsage[];
  /** Value declared in env.ts or .env.local.example, if detectable */
  defaultValue: string | null;
  /** Whether the flag appears to be defined (in env.ts / constants / .env.local.example) */
  defined: boolean;
  /** Diagnosis: 'active' | 'always-on' | 'always-off' | 'unused' */
  status: 'active' | 'always-on' | 'always-off' | 'unused';
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ROOT = join(__dirname, '..');

/** Directories to scan for flag references */
const SCAN_DIRS = ['src', 'app', 'scripts'];

/** File extensions to scan */
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/** Files / dirs to skip */
const SKIP_PATTERNS = [
  'node_modules',
  '.next',
  'storybook-static',
  'coverage',
  'playwright-report',
  'test-results',
  '.husky',
  '__snapshots__',
];

/** Pattern that identifies a feature flag */
const FLAG_PATTERN = /NEXT_PUBLIC_[A-Z0-9_]+_ENABLED/g;

// ─── File walker ───────────────────────────────────────────────────────────────

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_PATTERNS.includes(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walkFiles(full);
    } else if (SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      yield full;
    }
  }
}

// ─── Scan ──────────────────────────────────────────────────────────────────────

function scanForFlags(): Map<string, FlagUsage[]> {
  const results = new Map<string, FlagUsage[]>();

  for (const dir of SCAN_DIRS) {
    const fullDir = join(ROOT, dir);
    try {
      for (const file of walkFiles(fullDir)) {
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          const matches = line.match(FLAG_PATTERN);
          if (!matches) return;
          for (const flag of matches) {
            const existing = results.get(flag) ?? [];
            existing.push({
              file: relative(ROOT, file),
              line: idx + 1,
              snippet: line.trim().slice(0, 120),
            });
            results.set(flag, existing);
          }
        });
      }
    } catch {
      // Directory may not exist in all environments
    }
  }

  return results;
}

// ─── Detect default values from env.ts ────────────────────────────────────────

function detectDefaults(): Map<string, string> {
  const defaults = new Map<string, string>();
  const envFilePath = join(ROOT, 'src', 'lib', 'env.ts');
  try {
    const content = readFileSync(envFilePath, 'utf8');
    // Match patterns like: NEXT_PUBLIC_NFT_ENABLED: booleanEnv('NEXT_PUBLIC_NFT_ENABLED'),
    const lines = content.split('\n');
    for (const line of lines) {
      const flagMatch = line.match(/(NEXT_PUBLIC_[A-Z0-9_]+_ENABLED)/);
      if (!flagMatch) continue;
      const flag = flagMatch[1];
      if (line.includes('booleanEnv(')) {
        defaults.set(flag, 'false (booleanEnv — defaults to false when unset)');
      } else if (line.includes('true')) {
        defaults.set(flag, 'true');
      } else {
        defaults.set(flag, 'false');
      }
    }
  } catch {
    // env.ts not found; skip
  }
  return defaults;
}

// ─── Detect .env.local.example values ─────────────────────────────────────────

function detectEnvExampleValues(): Map<string, string> {
  const vals = new Map<string, string>();
  const examplePath = join(ROOT, '.env.local.example');
  try {
    const lines = readFileSync(examplePath, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^(NEXT_PUBLIC_[A-Z0-9_]+_ENABLED)=(.*)$/);
      if (m) vals.set(m[1], m[2].trim());
    }
  } catch {
    // file may not exist
  }
  return vals;
}

// ─── Build report ─────────────────────────────────────────────────────────────

function buildReport(): FlagReport[] {
  const usagesMap = scanForFlags();
  const defaults = detectDefaults();
  const exampleValues = detectEnvExampleValues();

  // Collect all known flag names (union of all sources)
  const allFlags = new Set<string>([
    ...usagesMap.keys(),
    ...defaults.keys(),
    ...exampleValues.keys(),
  ]);

  const reports: FlagReport[] = [];

  for (const flag of Array.from(allFlags).sort()) {
    const usages = usagesMap.get(flag) ?? [];
    const defaultVal = defaults.get(flag) ?? exampleValues.get(flag) ?? null;
    const defined = defaults.has(flag) || exampleValues.has(flag);

    let status: FlagReport['status'];
    if (usages.length === 0) {
      status = 'unused';
    } else if (defaultVal?.includes('true') && !defaultVal.includes('false')) {
      status = 'always-on';
    } else if (defaultVal?.includes('false') && !defaultVal.includes('true') && usages.length > 0) {
      // Flag defaults to false — "always-off" unless there's an override path
      // We conservatively mark as 'active' since the override may be in .env.local
      status = 'active';
    } else {
      status = 'active';
    }

    // If the flag is defined but has zero code usages, it's truly unused
    if (defined && usages.length === 0) {
      status = 'unused';
    }

    reports.push({ name: flag, usages, defaultValue: defaultVal, defined, status });
  }

  return reports;
}

// ─── Output ────────────────────────────────────────────────────────────────────

function printReport(reports: FlagReport[]): void {
  const separator = '─'.repeat(80);

  console.error('\n' + separator);
  console.error('  ILN Frontend — Feature Flag Audit');
  console.error(separator + '\n');

  const byStatus = {
    active: reports.filter((r) => r.status === 'active'),
    'always-on': reports.filter((r) => r.status === 'always-on'),
    'always-off': reports.filter((r) => r.status === 'always-off'),
    unused: reports.filter((r) => r.status === 'unused'),
  };

  console.error(`Total flags found: ${reports.length}`);
  console.error(`  ✅  active     : ${byStatus.active.length}`);
  console.error(`  🔴  always-on  : ${byStatus['always-on'].length}`);
  console.error(`  ⚪  always-off : ${byStatus['always-off'].length}`);
  console.error(`  ⚠️   unused     : ${byStatus.unused.length}`);
  console.error('');

  for (const report of reports) {
    const icon =
      report.status === 'active'
        ? '✅'
        : report.status === 'always-on'
          ? '🔴'
          : report.status === 'always-off'
            ? '⚪'
            : '⚠️';

    console.error(`${icon}  ${report.name}`);
    console.error(
      `    status        : ${report.status}${report.defaultValue ? ` (default: ${report.defaultValue})` : ''}`
    );
    console.error(
      `    defined in env : ${report.defined ? 'yes' : 'no — consider adding to src/lib/env.ts'}`
    );
    console.error(`    usage count   : ${report.usages.length}`);

    if (report.usages.length > 0) {
      console.error('    references:');
      for (const u of report.usages) {
        console.error(`      ${u.file}:${u.line}`);
        console.error(`        ${u.snippet}`);
      }
    }

    if (report.status === 'unused') {
      console.error(
        '    ⚠️  ACTION: This flag has no code references. Consider removing it from env.ts and .env.local.example.'
      );
    }

    if (report.status === 'always-on') {
      console.error(
        '    🔴 ACTION: This flag defaults to true. If the feature is fully shipped, remove the flag and all conditional checks.'
      );
    }

    console.error('');
  }

  console.error(separator);
  console.error('  For the flag lifecycle policy, see CONTRIBUTING.md § Feature Flag Lifecycle.');
  console.error(separator + '\n');
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const reports = buildReport();
printReport(reports);

// Exit 0 — this is an informational report, not a blocking gate
process.exit(0);
