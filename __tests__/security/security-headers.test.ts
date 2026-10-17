import { describe, it, expect } from 'vitest';
import nextConfigExport from '../../next.config';

describe('Security Headers and CSP Configuration', () => {
  it('defines strict security headers for all routes', async () => {
    // nextConfig is wrapped by withPWA or exported directly
    const config = nextConfigExport as any;
    expect(config.headers).toBeDefined();

    const headersConfig = await config.headers();
    expect(Array.isArray(headersConfig)).toBe(true);

    const rootRule = headersConfig.find((rule: any) => rule.source === '/:path*');
    expect(rootRule).toBeDefined();

    const headerMap = new Map(rootRule.headers.map((h: any) => [h.key, h.value]));

    // Check Content-Security-Policy
    const csp = headerMap.get('Content-Security-Policy');
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain('https://fonts.gstatic.com');

    // Check Other Security Headers
    expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headerMap.get('X-Frame-Options')).toBe('DENY');
    expect(headerMap.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(headerMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headerMap.get('Permissions-Policy')).toContain('camera=()');
  });
});
