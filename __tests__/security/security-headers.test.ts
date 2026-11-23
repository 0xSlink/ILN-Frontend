import { describe, it, expect } from 'vitest';
import nextConfigExport from '../../next.config';

interface HeaderEntry {
  key: string;
  value: string;
}

interface HeaderRule {
  source: string;
  headers: HeaderEntry[];
}

function matchesNextRoutePattern(source: string, pathname: string): boolean {
  if (source === '/:path*') {
    return pathname.startsWith('/');
  }
  if (source.endsWith('/:path*')) {
    const prefix = source.slice(0, -'/:path*'.length);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  return source === pathname;
}

function resolveHeadersForRoute(rules: HeaderRule[], pathname: string): Map<string, string> {
  const resolved = new Map<string, string>();
  for (const rule of rules) {
    if (matchesNextRoutePattern(rule.source, pathname)) {
      for (const header of rule.headers) {
        resolved.set(header.key, header.value);
      }
    }
  }
  return resolved;
}

function parseCspDirectives(csp: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const rawDirective of csp.split(';')) {
    const trimmed = rawDirective.trim();
    if (!trimmed) continue;
    const [name, ...values] = trimmed.split(/\s+/);
    directives.set(name, values);
  }
  return directives;
}

function findPolicyViolations(headers: Map<string, string>): string[] {
  const violations: string[] = [];
  const csp = headers.get('Content-Security-Policy');
  if (!csp) {
    violations.push('Missing Content-Security-Policy header');
  } else {
    const directives = parseCspDirectives(csp);
    if (!directives.get('frame-ancestors')?.includes("'none'")) {
      violations.push("CSP must enforce frame-ancestors 'none'");
    }
    if (directives.get('frame-ancestors')?.includes('*')) {
      violations.push('CSP must not allow wildcard frame-ancestors');
    }
    for (const [directive, values] of directives.entries()) {
      if (new Set(values).size !== values.length) {
        violations.push(`CSP directive ${directive} contains duplicate entries`);
      }
    }
  }

  if (headers.get('X-Content-Type-Options') !== 'nosniff') {
    violations.push('X-Content-Type-Options must be nosniff');
  }
  if (headers.get('X-Frame-Options') !== 'DENY') {
    violations.push('X-Frame-Options must be DENY');
  }
  if (!headers.get('Referrer-Policy')) {
    violations.push('Referrer-Policy must be set');
  }

  return violations;
}

describe('Security Headers and CSP Configuration', () => {
  it('defines strict security headers for all routes without duplicate CSP sources', async () => {
    const config = nextConfigExport as { headers?: () => Promise<HeaderRule[]> };
    expect(config.headers).toBeDefined();

    const headersConfig = await config.headers!();
    expect(Array.isArray(headersConfig)).toBe(true);

    const rootRule = headersConfig.find((rule) => rule.source === '/:path*');
    expect(rootRule).toBeDefined();

    const headerMap = new Map(rootRule!.headers.map((h) => [h.key, h.value]));
    expect(findPolicyViolations(headerMap)).toEqual([]);

    const csp = headerMap.get('Content-Security-Policy')!;
    const directives = parseCspDirectives(csp);
    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('base-uri')).toEqual(["'self'"]);
    expect(directives.get('form-action')).toEqual(["'self'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    expect(directives.has('upgrade-insecure-requests')).toBe(true);
    expect(directives.get('style-src')).toContain('https://fonts.googleapis.com');
    expect(directives.get('font-src')).toContain('https://fonts.gstatic.com');

    const connectSrc = directives.get('connect-src') ?? [];
    expect(connectSrc).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://horizon.stellar.org',
        'https://horizon-testnet.stellar.org',
        'https://soroban-testnet.stellar.org',
        'https://soroban-rpc.stellar.org',
      ])
    );

    expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headerMap.get('X-Frame-Options')).toBe('DENY');
    expect(headerMap.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(headerMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headerMap.get('Permissions-Policy')).toContain('camera=()');
    expect(headerMap.get('Permissions-Policy')).toContain('microphone=()');
    expect(headerMap.get('Permissions-Policy')).toContain('geolocation=()');
  });

  it('covers wallet and financial routes with CSP, frame, referrer, and MIME headers', async () => {
    const config = nextConfigExport as { headers?: () => Promise<HeaderRule[]> };
    const rules = await config.headers!();

    const walletRoutes = [
      '/submit',
      '/freelancer',
      '/lp',
      '/payer',
      '/pay/inv-123',
      '/i/inv-123',
      '/invoices/batch',
      '/admin',
      '/governance',
    ];

    for (const route of walletRoutes) {
      const headers = resolveHeadersForRoute(rules, route);
      expect(findPolicyViolations(headers)).toEqual([]);
      expect(headers.get('X-Frame-Options')).toBe('DENY');
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    }
  });

  it('enforces hardened CSP, no-referrer, and no-store headers on API routes', async () => {
    const config = nextConfigExport as { headers?: () => Promise<HeaderRule[]> };
    const rules = await config.headers!();

    const apiRoutes = [
      '/api/auth/challenge',
      '/api/auth/verify',
      '/api/indexer/stats',
      '/api/leaderboard',
      '/api/notifications/GABC123',
      '/api/reminders',
    ];

    for (const route of apiRoutes) {
      const headers = resolveHeadersForRoute(rules, route);
      expect(findPolicyViolations(headers)).toEqual([]);

      const directives = parseCspDirectives(headers.get('Content-Security-Policy')!);
      expect(directives.get('default-src')).toEqual(["'none'"]);
      expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
      expect(directives.get('base-uri')).toEqual(["'none'"]);
      expect(directives.get('form-action')).toEqual(["'none'"]);
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(headers.get('X-Frame-Options')).toBe('DENY');
      expect(headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('preserves text/plain Content-Type for /.well-known/security.txt', async () => {
    const config = nextConfigExport as { headers?: () => Promise<HeaderRule[]> };
    const rules = await config.headers!();
    const headers = resolveHeadersForRoute(rules, '/.well-known/security.txt');

    expect(headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('flags regressed header sets missing protections or containing duplicate directives', () => {
    const regressed = new Map<string, string>([
      [
        'Content-Security-Policy',
        "default-src 'self'; connect-src 'self' 'self'; frame-ancestors *",
      ],
      ['X-Frame-Options', 'ALLOWALL'],
    ]);

    const violations = findPolicyViolations(regressed);
    expect(violations).toEqual(
      expect.arrayContaining([
        "CSP must enforce frame-ancestors 'none'",
        'CSP must not allow wildcard frame-ancestors',
        'CSP directive connect-src contains duplicate entries',
        'X-Content-Type-Options must be nosniff',
        'X-Frame-Options must be DENY',
        'Referrer-Policy must be set',
      ])
    );
  });
});
