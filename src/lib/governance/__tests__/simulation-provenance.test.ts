import { describe, expect, it } from 'vitest';
import {
  currentGovernancePreview,
  GOVERNANCE_PREVIEW_MAX_AGE_MS,
  governancePreviewFingerprint,
  stampGovernancePreview,
} from '../simulation';

const estimate = { isContractVerified: false, provenance: 'client-estimate' as const };
const contract = { isContractVerified: true, provenance: 'contract-rpc' as const };

describe('governance preview provenance (#1322)', () => {
  it('fingerprints payloads independently of key order and undefined fields', () => {
    expect(governancePreviewFingerprint({ a: 1, b: 2, c: undefined })).toBe(
      governancePreviewFingerprint({ b: 2, a: 1 })
    );
    expect(governancePreviewFingerprint({ a: 1 })).not.toBe(governancePreviewFingerprint({ a: 2 }));
  });

  it('returns a preview for the payload that produced it', () => {
    const preview = stampGovernancePreview(estimate, 'payload-a', 1_000);
    expect(currentGovernancePreview(preview, 'payload-a', 2_000)).toBe(estimate);
  });

  it('withholds a preview after the payload changes', () => {
    const preview = stampGovernancePreview(estimate, 'payload-a', 1_000);
    expect(currentGovernancePreview(preview, 'payload-b', 1_000)).toBeNull();
    expect(currentGovernancePreview(preview, null, 1_000)).toBeNull();
  });

  it('expires a contract result', () => {
    const preview = stampGovernancePreview(contract, 'payload-a', 1_000);
    expect(
      currentGovernancePreview(preview, 'payload-a', 1_000 + GOVERNANCE_PREVIEW_MAX_AGE_MS)
    ).toBe(contract);
    expect(
      currentGovernancePreview(preview, 'payload-a', 1_001 + GOVERNANCE_PREVIEW_MAX_AGE_MS)
    ).toBeNull();
  });

  it('never accepts a verified claim without contract provenance', () => {
    const claim = { isContractVerified: true, provenance: 'client-estimate' as const };
    const unlabeled = { isContractVerified: true };
    expect(currentGovernancePreview(stampGovernancePreview(claim, 'p', 1), 'p', 1)).toBeNull();
    expect(currentGovernancePreview(stampGovernancePreview(unlabeled, 'p', 1), 'p', 1)).toBeNull();
  });
});
