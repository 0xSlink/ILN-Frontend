import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  classifyRouteStatus,
  routeExistsInSource,
  smokeRoutes,
  staleDeploymentMessage,
} from '../e2e/support/testnet-smoke';

describe('classifyRouteStatus', () => {
  it('accepts any successful response', () => {
    expect(classifyRouteStatus(200, false)).toBe('ok');
    expect(classifyRouteStatus(204, false)).toBe('ok');
    expect(classifyRouteStatus(304, false)).toBe('ok');
  });

  it('treats a 404 as a stale deployment only when the route exists in source', () => {
    expect(classifyRouteStatus(404, true)).toBe('stale-deployment');
    expect(classifyRouteStatus(404, false)).toBe('failure');
  });

  it('fails on server errors and on a missing response', () => {
    expect(classifyRouteStatus(500, true)).toBe('failure');
    expect(classifyRouteStatus(undefined, true)).toBe('failure');
  });
});

describe('routeExistsInSource', () => {
  it('finds the routes exercised by the smoke spec in this repo', () => {
    for (const route of smokeRoutes) {
      expect(routeExistsInSource(route.path), route.path).toBe(true);
    }
  });

  it('returns false for a route that is not in the codebase', () => {
    expect(routeExistsInSource('/definitely-not-a-route')).toBe(false);
  });

  it('supports both the app/ and legacy src/app/ route trees', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'iln-smoke-routes-'));
    mkdirSync(path.join(root, 'app', 'new-route'), { recursive: true });
    writeFileSync(path.join(root, 'app', 'new-route', 'page.tsx'), 'export default () => null;');
    mkdirSync(path.join(root, 'src', 'app', 'legacy-route'), { recursive: true });
    writeFileSync(
      path.join(root, 'src', 'app', 'legacy-route', 'page.tsx'),
      'export default () => null;'
    );

    expect(routeExistsInSource('/new-route', root)).toBe(true);
    expect(routeExistsInSource('/legacy-route', root)).toBe(true);
    expect(routeExistsInSource('/missing', root)).toBe(false);
  });
});

describe('staleDeploymentMessage', () => {
  it('names the route and points to the redeploy guidance', () => {
    const message = staleDeploymentMessage('/marketplace');
    expect(message).toContain('/marketplace');
    expect(message).toContain('redeploy');
    expect(message).toContain('docs/troubleshooting.md');
  });
});
