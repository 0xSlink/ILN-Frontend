import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Static validation of public/.well-known/security.txt against the fields
 * required/recommended by RFC 9116. Live HTTP reachability at
 * /.well-known/security.txt is covered separately in e2e/security-txt.spec.ts,
 * since a Next.js dev/production server is required to prove real routing.
 */
describe('public/.well-known/security.txt (RFC 9116)', () => {
  const filePath = join(process.cwd(), 'public', '.well-known', 'security.txt');
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim().length > 0);

  it('contains at least one Contact field', () => {
    const contactLines = lines.filter((line) => line.startsWith('Contact:'));
    expect(contactLines.length).toBeGreaterThan(0);
  });

  it('contains a valid Expires field in the future', () => {
    const expiresLine = lines.find((line) => line.startsWith('Expires:'));
    expect(expiresLine).toBeDefined();

    const value = expiresLine!.replace('Expires:', '').trim();
    const expiresDate = new Date(value);
    expect(Number.isNaN(expiresDate.getTime())).toBe(false);
    expect(expiresDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('references the repository SECURITY.md as the disclosure policy', () => {
    const policyLine = lines.find((line) => line.startsWith('Policy:'));
    expect(policyLine).toBeDefined();
    expect(policyLine).toContain('SECURITY.md');
  });

  it('declares preferred languages', () => {
    const preferredLine = lines.find((line) => line.startsWith('Preferred-Languages:'));
    expect(preferredLine).toBeDefined();
  });

  it('every non-comment line follows the "Field: value" format', () => {
    for (const line of lines) {
      expect(line).toMatch(/^[A-Za-z-]+:\s*\S/);
    }
  });
});
