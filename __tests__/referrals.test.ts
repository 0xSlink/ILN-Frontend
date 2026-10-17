import { describe, it, expect } from 'vitest';
import { generateReferralCode } from '../src/utils/referrals';

// Mock SubtleCrypto if needed, but it's available in Node 19+ and vitest handles it usually
// If it fails, I might need to mock it.

describe('Referral Code Generation', () => {
  it('generates a deterministic 8-character code from a wallet address', async () => {
    const address = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6';
    const code1 = await generateReferralCode(address);
    const code2 = await generateReferralCode(address);

    expect(code1).toBeDefined();
    expect(code1.length).toBe(8);
    expect(code1).toBe(code2);
  });

  it('generates different codes for different addresses', async () => {
    const addr1 = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const addr2 = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6';

    const code1 = await generateReferralCode(addr1);
    const code2 = await generateReferralCode(addr2);

    expect(code1).not.toBe(code2);
  });
});
