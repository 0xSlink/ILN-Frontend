import { afterEach, describe, expect, it } from 'vitest';
import { generateReferralCode, getReferralLink } from '../referrals';

describe('generateReferralCode', () => {
  it('returns an empty string for an empty address', async () => {
    expect(await generateReferralCode('')).toBe('');
  });

  it('generates an 8-character uppercase hex code deterministically for the same address', async () => {
    const a = await generateReferralCode('GADDRESS1');
    const b = await generateReferralCode('GADDRESS1');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9A-F]{8}$/);
  });

  it('generates different codes for different addresses', async () => {
    const a = await generateReferralCode('GADDRESS1');
    const b = await generateReferralCode('GADDRESS2');
    expect(a).not.toBe(b);
  });
});

describe('getReferralLink', () => {
  afterEach(() => {
    (global as any).window = window;
  });

  it('builds a link using window.location.origin', () => {
    expect(getReferralLink('ABCD1234')).toBe(`${window.location.origin}/submit?ref=ABCD1234`);
  });

  it('falls back to a relative path when window is undefined', () => {
    const originalWindow = global.window;
    // @ts-expect-error simulating an SSR environment
    delete global.window;
    expect(getReferralLink('ABCD1234')).toBe('/submit?ref=ABCD1234');
    global.window = originalWindow;
  });
});
