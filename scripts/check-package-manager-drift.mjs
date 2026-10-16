#!/usr/bin/env node
/* eslint-disable no-console -- CLI script: human-readable and --json stdout output is its interface. */
/**
 * Package-manager drift check (#1118, #1119, #1120, #1121).
 *
 * Fails (exit 1) when workflow commands, lockfiles, and package-manager
 * declarations diverge, so a clean-runner `pnpm install --frozen-lockfile`
 * stays the single source of truth for installs:
 *
 *  1. `package.json` must declare `packageManager: pnpm@<version>`.
 *  2. Every `pnpm/action-setup` pin across `.github/workflows/*.yml` must be
 *     identical and equal to the `packageManager` version.
 *  3. Every workflow using `setup-node` must pin Node via
 *     `node-version-file: .nvmrc` (no hardcoded `node-version`), and `.nvmrc`
 *     must satisfy `engines.node`.
 *  4. `engines.pnpm` must be satisfied by the `packageManager` version.
 *  5. No bare `npm` install/audit/start invocations in workflows, and
 *     `.lighthouserc.json` must start the server with pnpm.
 *  6. Every `pnpm install` in workflows must pass `--frozen-lockfile`, and
 *     `pnpm-lock.yaml` must exist.
 *  7. CI must invoke named `package.json` script targets (no raw
 *     `pnpm exec tsc --noEmit` / `npm audit` hidden steps).
 *
 * Exit codes: 0 = no drift, 1 = drift detected or unreadable declaration.
 * No network access, no fabricated data, no silent fallback.
 */

import { existsSync, readFileSync, readdirSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WORKFLOWS_DIR = '.github/workflows';
export const LIGHTHOUSERCRC = '.lighthouserc.json';
export const NVMRC = '.nvmrc';
export const LOCKFILE = 'pnpm-lock.yaml';

const PNPM_SETUP_RE = /pnpm\/action-setup@\S*[\s\S]{0,200}?version:\s*['"]?([^\s'"]+)['"]?/;
const NODE_VERSION_FILE_RE = /node-version-file:\s*['"]?([^\s'"]+)['"]?/;
const NODE_VERSION_RE = /^[ \t]*node-version:\s*['"]?([^\s'"]+)['"]?/m;
const PNPM_INSTALL_RE = /pnpm\s+install\b/;
// Bare `npm` invocations that bypass the pnpm lockfile path (`npm install`,
// `npm audit`, `npm start`, ...). Step `name:` labels and `echo` output are
// documentation, not executed package-manager commands. One-shot `npx <tool>`
// CLIs (vercel, tsx) are intentionally out of scope: they do not install,
// audit, or start the project dependency tree.
const BARE_NPM_RE = /(^|[|&;`{(]|\s)npm\s+(install|audit|start|ci\b|run\b|exec\b)/;
const RAW_TSC_RE = /pnpm\s+exec\s+tsc\s+--noEmit/;

function readText(filePath, root) {
  return readFileSync(path.join(root, filePath), 'utf8');
}

function listWorkflows(root) {
  const dir = path.join(root, WORKFLOWS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort()
    .map((f) => path.join(WORKFLOWS_DIR, f));
}

/** Parse `pnpm@9.0.0` into `{ name, version }`; throws a typed error. */
export function parsePackageManager(value) {
  const match = typeof value === 'string' && value.match(/^(pnpm|npm|yarn)@(\S+)$/);
  if (!match) {
    throw new Error(
      `package.json "packageManager" must be declared as "pnpm@<version>" (received ${JSON.stringify(value)})`
    );
  }
  return { name: match[1], version: match[2] };
}

/** Minimal semver-range check for `exact`, `^`, `~`, comparators, and space-joined (AND) ranges. */
export function satisfiesRange(version, range) {
  if (!range || range === '*' || range === 'x') return true;
  const orGroups = String(range)
    .split('||')
    .map((s) => s.trim())
    .filter(Boolean);
  return orGroups.some((group) =>
    group
      .split(/\s+/)
      .filter(Boolean)
      .every((comparator) => satisfiesComparator(version, comparator))
  );
}

function parseVersion(version) {
  // Accept partial versions (`21`, `20.19`) by zero-padding, so ranges like
  // `>=20.19.0 <21` evaluate correctly.
  const raw = String(version).replace(/^v/, '').split('.');
  if (raw.length > 3 || raw.some((p) => p === '' || !/^\d+$/.test(p))) return null;
  while (raw.length < 3) raw.push('0');
  return raw.map(Number);
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function satisfiesComparator(version, comparator) {
  const parsed = parseVersion(version);
  if (!parsed) return false;
  let op = '=';
  let target = comparator;
  const opMatch = comparator.match(/^(>=|<=|>|<|=|~|\^)/);
  if (opMatch) {
    op = opMatch[1];
    target = comparator.slice(op.length);
  }
  const targetParts = parseVersion(target);
  if (!targetParts) return false;
  const cmp = compareVersions(parsed, targetParts);
  switch (op) {
    case '>':
      return cmp > 0;
    case '>=':
      return cmp >= 0;
    case '<':
      return cmp < 0;
    case '<=':
      return cmp <= 0;
    case '^':
      // ^9.0.0 := >=9.0.0 <10.0.0 (major > 0)
      return cmp >= 0 && parsed[0] === targetParts[0];
    case '~':
      // ~9.0.0 := >=9.0.0 <9.1.0
      return cmp >= 0 && parsed[0] === targetParts[0] && parsed[1] === targetParts[1];
    default:
      return cmp === 0;
  }
}

/** Collect every `pnpm/action-setup` version pin per workflow file. */
export function collectWorkflowPins(workflowFiles, root) {
  return workflowFiles.flatMap((file) => {
    const text = readText(file, root);
    const pins = [];
    const seen = new Set();
    // A repo may pin pnpm in several jobs per file; collect them all.
    const globalRe = new RegExp(PNPM_SETUP_RE.source, 'g');
    let match = globalRe.exec(text);
    while (match) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        pins.push({ file, pin: match[1] });
      }
      match = globalRe.exec(text);
    }
    return pins;
  });
}

/** Find bare npm/npx command lines that bypass the pnpm install path. */
export function collectNpmDrift(workflowFiles, root) {
  const hits = [];
  for (const file of workflowFiles) {
    readText(file, root)
      .split('\n')
      .forEach((line, index) => {
        const stripped = line.trim();
        if (!stripped || stripped.startsWith('#')) return;
        if (/^(-\s*)?name:/.test(stripped)) return;
        if (stripped.includes('echo')) return;
        if (BARE_NPM_RE.test(line)) hits.push({ file, line: index + 1, text: stripped });
      });
  }
  return hits;
}

/** Find `pnpm install` steps that do not use `--frozen-lockfile`. */
export function collectUnfrozenInstalls(workflowFiles, root) {
  const hits = [];
  for (const file of workflowFiles) {
    readText(file, root)
      .split('\n')
      .forEach((line, index) => {
        if (PNPM_INSTALL_RE.test(line) && !line.includes('--frozen-lockfile')) {
          hits.push({ file, line: index + 1, text: line.trim() });
        }
      });
  }
  return hits;
}

/**
 * Run the full drift audit against `root` (defaults to the repo root).
 * Returns `{ success, errors, summary }` without exiting, so tests can
 * assert on it directly.
 */
export function checkPackageManagerDrift(root = process.cwd()) {
  const errors = [];
  let packageJson;
  try {
    packageJson = JSON.parse(readText('package.json', root));
  } catch (err) {
    return {
      success: false,
      errors: [`package.json is missing or unparsable: ${err.message}`],
      summary: {},
    };
  }

  const summary = {};
  let manager = null;
  try {
    manager = parsePackageManager(packageJson.packageManager);
    summary.packageManager = packageJson.packageManager;
  } catch (err) {
    errors.push(err.message);
  }

  const workflowFiles = listWorkflows(root);
  summary.workflowsScanned = workflowFiles.length;

  // 2. pnpm pins must be uniform and match the packageManager declaration.
  const pins = collectWorkflowPins(workflowFiles, root);
  summary.workflowPins = [...new Set(pins.map((p) => p.pin))];
  if (pins.length === 0) {
    errors.push(`No pnpm/action-setup version pin found under ${WORKFLOWS_DIR}`);
  } else if (manager) {
    for (const { file, pin } of pins) {
      if (pin !== manager.version) {
        errors.push(
          `${file} pins pnpm/action-setup@${pin} but package.json declares packageManager pnpm@${manager.version}`
        );
      }
    }
  }

  // 3. Node must be pinned via .nvmrc everywhere, and .nvmrc must satisfy engines.node.
  const enginesNode = packageJson.engines?.node;
  summary.enginesNode = enginesNode ?? '(missing)';
  let nvmrc = null;
  try {
    nvmrc = readText(NVMRC, root).trim().replace(/^v/, '');
    summary.nvmrc = nvmrc;
  } catch {
    errors.push(`${NVMRC} is missing; workflows resolve Node from it`);
  }
  for (const file of workflowFiles) {
    const text = readText(file, root);
    if (!text.includes('setup-node')) continue;
    if (!NODE_VERSION_FILE_RE.test(text)) {
      errors.push(
        `${file} uses setup-node without node-version-file (Node version would drift from ${NVMRC})`
      );
    }
    const hardPin = text.match(NODE_VERSION_RE);
    if (hardPin) {
      errors.push(`${file} hardcodes node-version ${hardPin[1]} instead of node-version-file`);
    }
  }
  if (enginesNode && nvmrc && !satisfiesRange(nvmrc, enginesNode)) {
    errors.push(`${NVMRC} (${nvmrc}) does not satisfy engines.node (${enginesNode})`);
  }

  // 4. engines.pnpm must admit the declared packageManager version.
  const enginesPnpm = packageJson.engines?.pnpm;
  summary.enginesPnpm = enginesPnpm ?? '(missing)';
  if (!enginesPnpm) {
    errors.push(
      'package.json engines.pnpm is missing; CI pnpm pins cannot be validated against it'
    );
  } else if (manager && !satisfiesRange(manager.version, enginesPnpm)) {
    errors.push(
      `packageManager pnpm@${manager.version} does not satisfy engines.pnpm (${enginesPnpm})`
    );
  }
  if (manager && manager.name !== 'pnpm') {
    errors.push(`packageManager must use pnpm (received "${packageJson.packageManager}")`);
  }

  // 5. No bare npm/npx escapes; Lighthouse must boot via pnpm.
  for (const hit of collectNpmDrift(workflowFiles, root)) {
    errors.push(
      `${hit.file}:${hit.line} runs bare npm ("${hit.text}"); use the pnpm-locked equivalent`
    );
  }
  try {
    const lhrc = JSON.parse(readText(LIGHTHOUSERCRC, root));
    const startCommand = lhrc?.ci?.collect?.startServerCommand;
    summary.lighthousercStartCommand = startCommand ?? '(missing)';
    if (typeof startCommand !== 'string' || !startCommand.includes('pnpm')) {
      errors.push(
        `${LIGHTHOUSERCRC} startServerCommand must use pnpm (received ${JSON.stringify(startCommand)})`
      );
    }
  } catch (err) {
    errors.push(`${LIGHTHOUSERCRC} is missing or unparsable: ${err.message}`);
  }

  // 6. Frozen lockfile installs only.
  summary.lockfile = LOCKFILE;
  if (!existsSync(path.join(root, LOCKFILE))) {
    errors.push(`${LOCKFILE} is missing; frozen-lockfile installs have nothing to pin against`);
  }
  for (const hit of collectUnfrozenInstalls(workflowFiles, root)) {
    errors.push(
      `${hit.file}:${hit.line} runs pnpm install without --frozen-lockfile ("${hit.text}")`
    );
  }

  // 7. CI must call named package.json targets, not raw hidden steps.
  for (const file of workflowFiles) {
    readText(file, root)
      .split('\n')
      .forEach((line, index) => {
        if (RAW_TSC_RE.test(line)) {
          errors.push(
            `${file}:${index + 1} runs raw "pnpm exec tsc --noEmit"; call the "typecheck" package.json script instead`
          );
        }
      });
  }

  return { success: errors.length === 0, errors, summary };
}

function main() {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const report = checkPackageManagerDrift(root);

  const lines = [
    'Package-manager drift check',
    `packageManager: ${report.summary.packageManager ?? '(missing)'}`,
    `engines.node: ${report.summary.enginesNode ?? '(missing)'} / .nvmrc: ${report.summary.nvmrc ?? '(missing)'}`,
    `engines.pnpm: ${report.summary.enginesPnpm ?? '(missing)'} / workflow pins: ${(report.summary.workflowPins ?? []).join(', ') || '(none)'}`,
    `lighthouserc start: ${report.summary.lighthousercStartCommand ?? '(missing)'} / workflows scanned: ${report.summary.workflowsScanned ?? 0}`,
    '',
  ];
  if (report.success) {
    lines.push('OK: workflows, lockfile, and package-manager declarations agree.');
  } else {
    lines.push(`DRIFT DETECTED (${report.errors.length}):`);
    for (const error of report.errors) lines.push(`- ${error}`);
  }
  const output = lines.join('\n');
  console.log(output);

  // Retain workflow smoke evidence (1120): mirror the report into the
  // GitHub step summary when running under Actions.
  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary) {
    try {
      appendFileSync(
        stepSummary,
        `### Package-manager drift check\n\n\`\`\`\n${output}\n\`\`\`\n\n${report.success ? 'PASS' : 'FAIL'}\n`
      );
    } catch {
      // Step-summary reporting must never mask the drift verdict.
    }
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  }
  process.exit(report.success ? 0 : 1);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}
