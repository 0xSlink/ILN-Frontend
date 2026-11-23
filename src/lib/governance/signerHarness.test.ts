import { createGovernanceSignerHarness, assertSignedGovernanceResult } from './signerHarness';

describe('governance signer harness', () => {
  it('records the exact XDR sent for signing and rejects fallback results', async () => {
    const harness = createGovernanceSignerHarness('signed-xdr');
    expect(await harness.sign('invoke-vote-xdr')).toBe('signed-xdr');
    expect(harness.submittedXdr).toEqual(['invoke-vote-xdr']);
    expect(() => assertSignedGovernanceResult('unsigned:123')).toThrow(/fabricated/);
  });
});

