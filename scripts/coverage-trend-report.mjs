#!/usr/bin/env node
/**
 * #891 — per-directory coverage-trend report.
 *
 * `vitest.config.ts` enforces a single global threshold across every file in
 * the coverage `include` list. That is enough to stop new code shipping
 * untested, but it is *not* enough to stop a single directory from silently
 * regressing: one well-covered directory can absorb the slack created by
 * another directory losing coverage, and the global number never moves. That
 * is exactly how the original 6-file contract-layer scope drifted without
 * anyone noticing.
 *
 * This script closes that gap. It reads the `json-summary` coverage report
 * produced by the CI `coverage` job, aggregates every metric into the
 * directories under enforcement, and renders a markdown table comparing the
 * PR's numbers against a stored baseline — so a reviewer's eye goes straight
 * to the one row that moved down, without diffing two Codecov uploads by hand.
 *
 * Usage:
 *   node scripts/coverage-trend-report.mjs \
 *     --summary coverage/coverage-summary.json \
 *     [--baseline coverage-baseline.json] \
 *     [--write-baseline coverage-baseline.json] \
 *     [--markdown-out coverage-trend.md] \
 *     [--regress-only]
 *
 * Exit codes:
 *   0 — report generated (and no directory regressed below its enforced floor)
 *   1 — a directory regressed past the floor passed via --floor, or the
 *       baseline file could not be parsed
 *   2 — the coverage summary itself is missing or malformed
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Directories under coverage enforcement, in the order they appear in
 * `vitest.config.ts`'s coverage `include` list. Kept here (rather than parsed
 * out of the config) because this is the reporting contract: a directory that
 * is not listed is, by definition, not being enforced, and showing it in the
 * trend table would imply a guarantee we do not make.
 */
const ENFORCED_DIRECTORIES = ['src/utils', 'src/lib', 'src/hooks', 'src/screens', 'src/context'];

const METRICS = ['lines', 'functions', 'branches', 'statements'];

function parseArgs(argv) {
  const args = { regressOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const [flag, inlineValue] =
      token.startsWith('--') && token.includes('=')
        ? [token.slice(0, token.indexOf('=')), token.slice(token.indexOf('=') + 1)]
        : [token, undefined];
    const value = () => inlineValue ?? argv[++i];
    switch (flag) {
      case '--summary':
        args.summary = value();
        break;
      case '--baseline':
        args.baseline = value();
        break;
      case '--write-baseline':
        args.writeBaseline = value();
        break;
      case '--markdown-out':
        args.markdownOut = value();
        break;
      case '--floor':
        args.floor = Number(value());
        break;
      case '--regress-only':
        args.regressOnly = true;
        break;
      default:
        throw new Error(`Unknown flag: ${token}`);
    }
  }
  return args;
}

/**
 * Maps a file path from the coverage report onto the enforced directory that
 * owns it. Vitest's `json-summary` report keys entries by absolute path, so
 * matching is done on a segment boundary (`/src/hooks/`) rather than a string
 * prefix. Returns null for files outside the enforced scope so that, for
 * example, a `src/components/` file reported in the same summary cannot be
 * silently folded into the `src/utils` row.
 */
function directoryFor(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  const best = ENFORCED_DIRECTORIES.filter(
    (dir) => normalized.startsWith(`${dir}/`) || normalized.includes(`/${dir}/`)
  ).sort((a, b) => b.length - a.length)[0];
  return best ?? null;
}

function readSummary(path) {
  if (!existsSync(path)) {
    console.error(
      `Coverage summary not found at ${path}. Run the CI coverage step (or \`pnpm test --coverage\`) first.`
    );
    process.exit(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`Coverage summary at ${path} is not valid JSON:`, err.message);
    process.exit(2);
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.total === 'undefined') {
    console.error(
      `Coverage summary at ${path} has no \`total\` entry; is it a json-summary report?`
    );
    process.exit(2);
  }
  return parsed;
}

function aggregate(summary) {
  const rows = new Map();
  for (const [filePath, entry] of Object.entries(summary)) {
    if (filePath === 'total') continue;
    const dir = directoryFor(filePath);
    if (!dir) continue;
    let row = rows.get(dir);
    if (!row) {
      row = {
        dir,
        files: 0,
        lines: { total: 0, covered: 0 },
        functions: { total: 0, covered: 0 },
        branches: { total: 0, covered: 0 },
        statements: { total: 0, covered: 0 },
      };
      rows.set(dir, row);
    }
    row.files += 1;
    for (const metric of METRICS) {
      row[metric].total += entry[metric]?.total ?? 0;
      row[metric].covered += entry[metric]?.covered ?? 0;
    }
  }
  return ENFORCED_DIRECTORIES.filter((dir) => rows.has(dir)).map((dir) => rows.get(dir));
}

function percent(bucket) {
  if (bucket.total === 0) return null;
  return (bucket.covered / bucket.total) * 100;
}

function formatPercent(value) {
  return value === null ? 'n/a' : `${value.toFixed(1)}%`;
}

function formatDelta(current, previous) {
  if (current === null || previous === null) return '—';
  const delta = current - previous;
  const sign = delta > 0.05 ? '+' : '';
  const marker = delta < -0.05 ? ' ⚠️' : '';
  return `${sign}${delta.toFixed(1)}pp${marker}`;
}

function buildMarkdown(rows, baselineRows, floor, regressOnly) {
  const lines = [
    '## 📈 Per-directory coverage trend',
    '',
    `Enforced directories from \`vitest.config.ts\`. Global thresholds can hide a regression in a` +
      ' single directory when another directory gains coverage — this table is the check for that.',
    '',
  ];

  if (!baselineRows) {
    lines.push(
      '_No baseline found — this run establishes it. Values below are absolute; the next run will show deltas._',
      ''
    );
  }

  lines.push(
    '| Directory | Files | Lines | Functions | Branches | Statements |',
    '| --- | ---: | ---: | ---: | ---: | ---: |'
  );

  let shown = 0;
  for (const row of rows) {
    const current = Object.fromEntries(METRICS.map((m) => [m, percent(row[m])]));
    const base = baselineRows?.get(row.dir);
    const regressed = METRICS.some(
      (m) => current[m] !== null && floor !== undefined && current[m] < floor
    );
    if (regressOnly && base && !regressed) {
      const moved = METRICS.some(
        (m) => current[m] !== null && base[m] !== null && Math.abs(current[m] - base[m]) > 0.05
      );
      if (!moved) continue;
    }
    shown += 1;
    const cell = (m) => {
      const baseValue = base?.[m] ?? null;
      const value = formatPercent(current[m]);
      if (baseValue === null) return value;
      return `${value} (${formatDelta(current[m], baseValue)})`;
    };
    lines.push(
      `| \`${row.dir}/\`${regressed ? ' 🔻' : ''} | ${row.files} | ${cell('lines')} | ${cell('functions')} | ${cell('branches')} | ${cell('statements')} |`
    );
  }

  if (shown === 0) {
    lines.push('| _No directory moved._ | | | | | |');
  }

  lines.push('');
  if (floor !== undefined) {
    lines.push(
      `Enforced floor for this report: **${floor}%** per metric. A 🔻 marks a directory below the floor;` +
        ' the authoritative gate remains the global threshold in `vitest.config.ts`.',
      ''
    );
  }
  lines.push(
    'Scope reminder: directories absent from `vitest.config.ts` coverage `include` are **not** enforced.' +
      ' See [docs/testing.md](../blob/dev/docs/testing.md#coverage-gates) for the current scope and the' +
      ' phased roadmap for what comes next.',
    ''
  );
  return lines.join('\n');
}

function toBaseline(rows) {
  const out = {};
  for (const row of rows) {
    out[row.dir] = {
      files: row.files,
      ...Object.fromEntries(METRICS.map((m) => [m, percent(row[m])])),
    };
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const summaryPath = args.summary ?? 'coverage/coverage-summary.json';
  const summary = readSummary(summaryPath);
  const rows = aggregate(summary);
  const floor = args.floor;

  let baselineRows = null;
  if (args.baseline && existsSync(args.baseline)) {
    try {
      const parsed = JSON.parse(readFileSync(args.baseline, 'utf8'));
      baselineRows = new Map(
        Object.entries(parsed).map(([dir, value]) => [
          dir,
          Object.fromEntries(METRICS.map((m) => [m, value?.[m] ?? null])),
        ])
      );
    } catch (err) {
      console.error(`Baseline at ${args.baseline} is not valid JSON:`, err.message);
      process.exit(1);
    }
  }

  const markdown = buildMarkdown(rows, baselineRows, floor, args.regressOnly);
  process.stdout.write(`${markdown}\n`);

  if (args.markdownOut) {
    mkdirSync(dirname(resolve(args.markdownOut)), { recursive: true });
    writeFileSync(resolve(args.markdownOut), `${markdown}\n`);
  }

  if (args.writeBaseline) {
    mkdirSync(dirname(resolve(args.writeBaseline)), { recursive: true });
    writeFileSync(resolve(args.writeBaseline), `${JSON.stringify(toBaseline(rows), null, 2)}\n`);
  }

  if (floor !== undefined) {
    const breaches = rows.filter((row) =>
      METRICS.some((m) => {
        const value = percent(row[m]);
        return value !== null && value < floor;
      })
    );
    if (breaches.length > 0) {
      console.error(
        `Coverage trend check failed — below the ${floor}% floor: ${breaches
          .map((b) => b.dir)
          .join(', ')}`
      );
      process.exit(1);
    }
  }

  process.exit(0);
}

main();
