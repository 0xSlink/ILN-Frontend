import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  checkPackageManagerDrift,
  parsePackageManager,
  satisfiesRange,
} from '../scripts/check-package-manager-drift.mjs';

describe('Package-manager drift check (#1118-#1121)', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function writeRoot(files: Record<string, string>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'pm-drift-'));
    tempDirs.push(root);
    for (const [file, contents] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), contents);
    }
    return root;
  }

  const packageJson = JSON.stringify({
    packageManager: 'pnpm@9.0.0',
    engines: { node: '>=20.19.0 <21', pnpm: '9.0.0' },
  });
  const cleanWorkflow = [
    'jobs:',
    '  check:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: pnpm/action-setup@v4',
    '        with:',
    "          version: '9.0.0'",
    '      - uses: actions/setup-node@v4',
    '        with:',
    "          node-version-file: '.nvmrc'",
    "          cache: 'pnpm'",
    '      - run: pnpm install --frozen-lockfile',
    '      - run: pnpm run typecheck',
    '',
  ].join('\n');
  const lighthouserc = JSON.stringify({ ci: { collect: { startServerCommand: 'pnpm start' } } });

  function cleanRoot(overrides: Record<string, string> = {}): string {
    return writeRoot({
      'package.json': packageJson,
      '.nvmrc': '20.20.2\n',
      'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
      '.lighthouserc.json': lighthouserc,
      '.github/workflows/ci.yml': cleanWorkflow,
      ...overrides,
    });
  }

  it('passes on the real repo root (no drift)', () => {
    const report = checkPackageManagerDrift(process.cwd());
    expect(report.errors).toEqual([]);
    expect(report.success).toBe(true);
  });

  it('fails when packageManager is missing', () => {
    const root = cleanRoot({
      'package.json': JSON.stringify({ engines: { node: '>=20.19.0 <21', pnpm: '9.0.0' } }),
    });
    const report = checkPackageManagerDrift(root);
    expect(report.success).toBe(false);
    expect(report.errors.some((e) => e.includes('packageManager'))).toBe(true);
  });

  it('fails when a workflow pnpm pin diverges from packageManager', () => {
    const root = cleanRoot({
      '.github/workflows/ci.yml': cleanWorkflow.replace("version: '9.0.0'", "version: '10.0.0'"),
    });
    const report = checkPackageManagerDrift(root);
    expect(report.success).toBe(false);
    expect(report.errors.some((e) => e.includes('10.0.0') && e.includes('9.0.0'))).toBe(true);
  });

  it('fails on bare npm audit and raw tsc hidden steps', () => {
    const root = cleanRoot({
      '.github/workflows/ci.yml': [
        'jobs:',
        '  lint:',
        '    steps:',
        '      - uses: pnpm/action-setup@v4',
        '        with:',
        "          version: '9.0.0'",
        '      - uses: actions/setup-node@v4',
        '        with:',
        "          node-version-file: '.nvmrc'",
        '      - run: pnpm install --frozen-lockfile',
        '      - run: npm audit --audit-level=moderate',
        '      - run: pnpm exec tsc --noEmit',
        '',
      ].join('\n'),
    });
    const report = checkPackageManagerDrift(root);
    expect(report.success).toBe(false);
    expect(report.errors.some((e) => e.includes('bare npm'))).toBe(true);
    expect(report.errors.some((e) => e.includes('typecheck'))).toBe(true);
  });

  it('fails on unfrozen installs and npm-started Lighthouse', () => {
    const root = cleanRoot({
      '.github/workflows/ci.yml': cleanWorkflow.replace(
        'pnpm install --frozen-lockfile',
        'pnpm install'
      ),
      '.lighthouserc.json': JSON.stringify({
        ci: { collect: { startServerCommand: 'npm start' } },
      }),
    });
    const report = checkPackageManagerDrift(root);
    expect(report.success).toBe(false);
    expect(report.errors.some((e) => e.includes('--frozen-lockfile'))).toBe(true);
    expect(report.errors.some((e) => e.includes('.lighthouserc.json'))).toBe(true);
  });

  it('fails when .nvmrc does not satisfy engines.node', () => {
    const root = cleanRoot({ '.nvmrc': '22.0.0\n' });
    const report = checkPackageManagerDrift(root);
    expect(report.success).toBe(false);
    expect(report.errors.some((e) => e.includes('.nvmrc') && e.includes('engines.node'))).toBe(
      true
    );
  });

  it('fails when a workflow hardcodes node-version instead of node-version-file', () => {
    const root = cleanRoot({
      '.github/workflows/ci.yml': [
        'jobs:',
        '  lint:',
        '    steps:',
        '      - uses: actions/setup-node@v4',
        '        with:',
        "          node-version: '20.20.2'",
        '      - run: pnpm install --frozen-lockfile',
        '',
      ].join('\n'),
    });
    const report = checkPackageManagerDrift(root);
    expect(report.success).toBe(false);
    expect(report.errors.some((e) => e.includes('node-version-file'))).toBe(true);
  });

  it('fails when packageManager does not use pnpm', () => {
    const root = cleanRoot({
      'package.json': JSON.stringify({
        packageManager: 'npm@10.0.0',
        engines: { node: '>=20.19.0 <21', pnpm: '9.0.0' },
      }),
    });
    const report = checkPackageManagerDrift(root);
    expect(report.success).toBe(false);
    expect(report.errors.some((e) => e.includes('must use pnpm'))).toBe(true);
  });

  describe('parsePackageManager', () => {
    it('accepts a pnpm pin and rejects missing declarations', () => {
      expect(parsePackageManager('pnpm@9.0.0')).toEqual({ name: 'pnpm', version: '9.0.0' });
      expect(() => parsePackageManager(undefined)).toThrow(/packageManager/);
      expect(() => parsePackageManager('not-a-pin')).toThrow(/packageManager/);
    });
  });

  describe('satisfiesRange', () => {
    it('evaluates engines-style ranges including partial versions', () => {
      expect(satisfiesRange('20.20.2', '>=20.19.0 <21')).toBe(true);
      expect(satisfiesRange('22.0.0', '>=20.19.0 <21')).toBe(false);
      expect(satisfiesRange('9.0.0', '9.0.0')).toBe(true);
      expect(satisfiesRange('9.1.0', '^9.0.0')).toBe(true);
      expect(satisfiesRange('10.0.0', '^9.0.0')).toBe(false);
    });
  });
});
