import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Static checks for the Lighthouse CI setup (#959).
 *
 * The final readiness check for this batch found Lighthouse had never run
 * against it: the workflow only triggered on `main`/`develop`, while every PR
 * targets `dev`. These tests keep the workflow pointed at the branch PRs
 * actually land on, and keep the audited URLs and LIGHTHOUSE_CI.md in step
 * with real app routes.
 */
const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf-8');

const INTEGRATION_BRANCH = 'dev';

function triggerBranches(workflow: string, event: 'push' | 'pull_request'): string[] {
  const match = workflow.match(new RegExp(`\\n  ${event}:\\n    branches: \\[([^\\]]*)\\]`));
  return match ? match[1].split(',').map((b) => b.trim()) : [];
}

describe('Lighthouse CI configuration (#959)', () => {
  const workflow = read('.github', 'workflows', 'lighthouse.yml');
  const lhrc = JSON.parse(read('.lighthouserc.json'));
  const auditedPaths: string[] = lhrc.ci.collect.url.map((u: string) => new URL(u).pathname);

  it('runs on pushes and pull requests to the integration branch', () => {
    expect(triggerBranches(workflow, 'push')).toContain(INTEGRATION_BRANCH);
    expect(triggerBranches(workflow, 'pull_request')).toContain(INTEGRATION_BRANCH);
  });

  it('only audits URLs that map to an existing app route', () => {
    for (const pathname of auditedPaths) {
      const page = join(root, 'app', ...pathname.split('/').filter(Boolean), 'page.tsx');
      expect(existsSync(page), `${pathname} -> ${page}`).toBe(true);
    }
  });

  it('documents exactly the pages that are audited', () => {
    const doc = read('docs', 'LIGHTHOUSE_CI.md');
    const section = doc.split('## Tested Pages')[1]?.split('\n## ')[0] ?? '';
    const documented = [...section.matchAll(/^- `([^`]+)`/gm)].map((m) => m[1].split(' ')[0]);
    expect(documented.sort()).toEqual([...auditedPaths].sort());
  });
});
