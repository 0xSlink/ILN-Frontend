import { describe, expect, it, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  auditRuntimeDependencies,
  evaluateRouteBudgets,
  FINANCIAL_ROUTE_BUDGETS_BYTES,
  GOVERNANCE_ROUTE_BUDGETS_BYTES,
  ROUTE_BUDGETS_BYTES,
  routeKeyToPath,
  runBudgetAndDependencyCheck,
} from '../scripts/check-route-bundle-size.mjs';

describe('route bundle and runtime dependency budget check', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createFixture(options: {
    manifest?: Record<string, unknown>;
    chunks?: Record<string, number>;
    dependencies?: Record<string, string>;
  }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'route-budget-'));
    tempDirs.push(root);

    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'fixture', dependencies: options.dependencies ?? {} })
    );

    if (options.manifest) {
      mkdirSync(path.join(root, '.next'), { recursive: true });
      writeFileSync(
        path.join(root, '.next', 'app-build-manifest.json'),
        JSON.stringify(options.manifest)
      );
    }

    for (const [relativePath, byteLength] of Object.entries(options.chunks ?? {})) {
      const fullPath = path.join(root, '.next', relativePath);
      mkdirSync(path.dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, Buffer.alloc(byteLength, 0x61));
    }

    return root;
  }

  it('normalizes Next.js app-build-manifest route keys', () => {
    expect(routeKeyToPath('/governance/page')).toBe('/governance');
    expect(routeKeyToPath('/pay/[id]/page')).toBe('/pay/[id]');
    expect(routeKeyToPath('/page')).toBe('/');
  });

  it('covers both governance and core financial routes in approved budgets', () => {
    expect(Object.keys(GOVERNANCE_ROUTE_BUDGETS_BYTES)).toContain('/governance');
    expect(Object.keys(FINANCIAL_ROUTE_BUDGETS_BYTES)).toEqual(
      expect.arrayContaining([
        '/submit',
        '/freelancer',
        '/lp',
        '/payer',
        '/pay/[id]',
        '/i/[id]',
        '/stats',
        '/analytics',
      ])
    );
    expect(ROUTE_BUDGETS_BYTES['/pay/[id]']).toBeGreaterThan(0);
  });

  it('passes when financial and governance routes stay within budget', () => {
    const manifest = {
      pages: {
        '/governance/page': ['static/chunks/gov.js', 'static/chunks/gov.css'],
        '/pay/[id]/page': ['static/chunks/pay.js'],
        '/lp/page': ['static/chunks/lp.js'],
      },
    };
    const sizes: Record<string, number> = {
      'static/chunks/gov.js': 200 * 1024,
      'static/chunks/gov.css': 999 * 1024,
      'static/chunks/pay.js': 500 * 1024,
      'static/chunks/lp.js': 600 * 1024,
    };

    const evaluation = evaluateRouteBudgets(manifest, {
      resolveFileSize: (file) => sizes[file] ?? 0,
    });

    expect(evaluation.withinBudget).toBe(true);
    const payResult = evaluation.results.find((entry) => entry.route === '/pay/[id]');
    expect(payResult).toMatchObject({
      found: true,
      bytes: 500 * 1024,
      withinBudget: true,
    });
  });

  it('fails when a financial route exceeds its approved bundle budget', () => {
    const manifest = {
      pages: {
        '/pay/[id]/page': ['static/chunks/pay-a.js', 'static/chunks/pay-b.js'],
      },
    };
    const evaluation = evaluateRouteBudgets(manifest, {
      resolveFileSize: () => 600 * 1024,
    });

    expect(evaluation.withinBudget).toBe(false);
    const payResult = evaluation.results.find((entry) => entry.route === '/pay/[id]');
    expect(payResult).toMatchObject({
      found: true,
      bytes: 1200 * 1024,
      withinBudget: false,
    });
  });

  it('flags unsafe runtime packages and unpinned/remote specifiers', () => {
    const audit = auditRuntimeDependencies({
      dependencies: {
        react: '19.2.4',
        vm2: '^3.9.19',
        shelljs: '^0.8.5',
        'unpinned-lib': 'latest',
        'remote-lib': 'https://evil.example.com/pkg.tgz',
        'local-lib': 'file:../patched-sdk',
      },
    });

    expect(audit.passed).toBe(false);
    expect(audit.violations.map((v) => `${v.package}:${v.kind}`)).toEqual(
      expect.arrayContaining([
        'vm2:unsafe-package',
        'shelljs:unsafe-package',
        'unpinned-lib:unsafe-specifier',
        'remote-lib:unsafe-specifier',
        'local-lib:unsafe-specifier',
      ])
    );
  });

  it('passes runtime dependency audit for the shipped repository package.json', () => {
    const report = runBudgetAndDependencyCheck({ depsOnly: true });
    expect(report.dependencyAudit.passed).toBe(true);
    expect(report.dependencyAudit.violations).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it('fails end-to-end on an over-budget financial route or unsafe dependency', () => {
    const root = createFixture({
      manifest: {
        pages: {
          '/submit/page': ['static/chunks/submit.js'],
        },
      },
      chunks: {
        'static/chunks/submit.js': 1100 * 1024,
      },
      dependencies: {
        puppeteer: '^22.0.0',
      },
    });

    const report = runBudgetAndDependencyCheck({ cwd: root });
    expect(report.withinBudget).toBe(false);
    expect(report.dependencyAudit.passed).toBe(false);
    expect(report.passed).toBe(false);
  });

  it('throws when the Next.js build manifest is missing outside deps-only mode', () => {
    const root = createFixture({
      dependencies: { react: '19.2.4' },
    });

    expect(() => runBudgetAndDependencyCheck({ cwd: root })).toThrow();
    expect(runBudgetAndDependencyCheck({ cwd: root, depsOnly: true }).passed).toBe(true);
  });
});
