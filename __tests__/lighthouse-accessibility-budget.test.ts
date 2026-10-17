import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Static validation of the Lighthouse accessibility budgets in .lighthouserc.json.
 *
 * Accessibility is a blocking quality gate (#1124) with an explicit per-route
 * budget for every representative route (#1125). This test guards that contract
 * so a later edit cannot silently downgrade the gate back to a warning or drop a
 * route's budget. The live Lighthouse run itself is covered by
 * .github/workflows/lighthouse.yml.
 */

type Assertion = string | [string, Record<string, number>];

interface AssertMatrixEntry {
  matchingUrlPattern: string;
  assertions: Record<string, Assertion>;
}

interface LighthouseConfig {
  ci: {
    collect: { url: string[] };
    assert: {
      assertions?: Record<string, Assertion>;
      assertMatrix?: AssertMatrixEntry[];
    };
  };
}

const config = JSON.parse(
  readFileSync(join(process.cwd(), '.lighthouserc.json'), 'utf-8')
) as LighthouseConfig;

const auditedRoutes = config.ci.collect.url;
const matrix = config.ci.assert.assertMatrix ?? [];

const matchingEntries = (url: string): AssertMatrixEntry[] =>
  matrix.filter((entry) => new RegExp(entry.matchingUrlPattern).test(url));

const assertionsFor = (url: string): Record<string, Assertion> =>
  matchingEntries(url).reduce<Record<string, Assertion>>(
    (acc, entry) => ({ ...acc, ...entry.assertions }),
    {}
  );

describe('.lighthouserc.json accessibility budgets', () => {
  it('does not combine assertMatrix with a flat assertions block', () => {
    // @lhci/cli throws "Cannot use assertMatrix with other options" otherwise.
    expect(matrix.length).toBeGreaterThan(0);
    expect(config.ci.assert.assertions).toBeUndefined();
  });

  it('matches every audited route against at least one assertMatrix entry', () => {
    expect(auditedRoutes.length).toBeGreaterThan(0);
    for (const url of auditedRoutes) {
      expect(matchingEntries(url).length, `no assertMatrix entry matches ${url}`).toBeGreaterThan(
        0
      );
    }
  });

  it.each(auditedRoutes)('blocks on accessibility for %s at a score of at least 0.9', (url) => {
    const assertion = assertionsFor(url)['categories:accessibility'];
    expect(assertion, `${url} has no accessibility assertion`).toBeDefined();
    expect(Array.isArray(assertion)).toBe(true);

    const [level, options] = assertion as [string, { minScore: number }];
    expect(level).toBe('error');
    expect(options.minScore).toBeGreaterThanOrEqual(0.9);
  });
});
