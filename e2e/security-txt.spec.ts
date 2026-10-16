import { expect, test } from '@playwright/test';

test.describe('security.txt (RFC 9116)', () => {
  test('is reachable at /.well-known/security.txt and served as text/plain', async ({
    request,
  }) => {
    const response = await request.get('/.well-known/security.txt');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');

    const body = await response.text();
    expect(body).toMatch(/^Contact:/m);
    expect(body).toMatch(/^Expires:/m);
    expect(body).toMatch(/^Policy:\s*https:\/\/github\.com\/.+SECURITY\.md/m);
  });
});
