export interface GovernanceSignerHarness {
  submittedXdr: string[];
  sign: (xdr: string) => Promise<string>;
}

export function createGovernanceSignerHarness(signedXdr = 'signed-governance-xdr'): GovernanceSignerHarness {
  const submittedXdr: string[] = [];
  return { submittedXdr, sign: async (xdr: string) => { submittedXdr.push(xdr); return signedXdr; } };
}

export function assertSignedGovernanceResult(result: string): void {
  if (!result || /^unsigned:/i.test(result) || /random/i.test(result)) {
    throw new Error('Governance mutation returned an unsigned or fabricated transaction result.');
  }
}

