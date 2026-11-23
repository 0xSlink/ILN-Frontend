import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SIGNOFF_GATES,
  MUTATION_JOURNEYS,
  validateReleaseSignoff,
  validateMutationJourneys,
} from '../release-signoff';

const passingGate = {
  status: 'passed' as const,
  evidence: 'https://github.com/Invoice-Liquidity-Network/ILN-Frontend/actions/runs/1',
  signedOffBy: 'release-manager',
  signedOffAt: '2026-10-15T10:00:00Z',
};

const passingJourneys = {
  funding: passingGate,
  settlement: passingGate,
  cancel: passingGate,
  claim: passingGate,
  governance_mutation: passingGate,
};

const passingSignoff = {
  release: 'v1.0.0',
  gates: {
    governance: passingGate,
    wallet: passingGate,
    indexer: passingGate,
    accessibility: passingGate,
  },
};

describe('validateReleaseSignoff', () => {
  it('accepts a complete sign-off with all gates passed', () => {
    expect(validateReleaseSignoff(passingSignoff)).toEqual({ ok: true, problems: [] });
  });

  it('rejects a non-object sign-off', () => {
    expect(validateReleaseSignoff(null).ok).toBe(false);
    expect(validateReleaseSignoff('v1').ok).toBe(false);
  });

  it('reports a missing gate', () => {
    const { indexer: _omit, ...gates } = passingSignoff.gates;
    const result = validateReleaseSignoff({ ...passingSignoff, gates });
    expect(result.ok).toBe(false);
    expect(result.problems).toContainEqual({
      gate: 'indexer',
      message: 'gate sign-off is missing',
    });
  });

  it('rejects a gate that is not passed', () => {
    const result = validateReleaseSignoff({
      ...passingSignoff,
      gates: { ...passingSignoff.gates, wallet: { ...passingGate, status: 'pending' } },
    });
    expect(result.ok).toBe(false);
    expect(result.problems.map((p) => p.gate)).toEqual(['wallet']);
  });

  it('requires evidence, a signer, and a valid timestamp for every gate', () => {
    const result = validateReleaseSignoff({
      release: 'v1.0.0',
      gates: Object.fromEntries(
        SIGNOFF_GATES.map((gate) => [
          gate,
          { status: 'passed', evidence: ' ', signedOffBy: '', signedOffAt: 'yesterday' },
        ])
      ),
    });
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(SIGNOFF_GATES.length * 3);
  });

  it('requires a release identifier', () => {
    const result = validateReleaseSignoff({ ...passingSignoff, release: '' });
    expect(result.problems).toContainEqual({
      gate: 'release',
      message: 'release identifier is required',
    });
  });

  it('keeps the committed template structurally valid, with every gate still pending', () => {
    const template = JSON.parse(
      readFileSync(join(process.cwd(), 'docs', 'release', 'signoff.template.json'), 'utf8')
    );
    const result = validateReleaseSignoff(template);
    // Every gate is unsigned, so each one reports status, evidence, signer, and timestamp.
    expect(result.problems.filter((p) => p.gate === 'release')).toEqual([]);
    expect(result.problems).toHaveLength(SIGNOFF_GATES.length * 4);
    expect(result.problems.some((p) => p.message.startsWith('status must be'))).toBe(true);
  });

  it('accepts complete sign-off with all extended mutation journeys passed', () => {
    const signoffWithJourneys = {
      ...passingSignoff,
      journeys: passingJourneys,
    };
    const result = validateReleaseSignoff(signoffWithJourneys, { requireJourneys: true });
    expect(result).toEqual({ ok: true, problems: [] });
  });

  it('reports missing or failed mutation journeys', () => {
    const incompleteJourneys = {
      ...passingSignoff,
      journeys: {
        funding: passingGate,
        settlement: { ...passingGate, status: 'failed' as const },
        // cancel is missing
        claim: { ...passingGate, status: 'pending' as const },
        governance_mutation: passingGate,
      },
    };
    const result = validateReleaseSignoff(incompleteJourneys, { requireJourneys: true });
    expect(result.ok).toBe(false);
    const affected = result.problems.map((p) => p.gate);
    expect(affected).toContain('settlement');
    expect(affected).toContain('cancel');
    expect(affected).toContain('claim');
  });

  it('is deterministic and idempotent across repeated validations', () => {
    const signoffWithJourneys = {
      ...passingSignoff,
      journeys: passingJourneys,
    };
    const run1 = validateReleaseSignoff(signoffWithJourneys, { requireJourneys: true });
    const run2 = validateReleaseSignoff(signoffWithJourneys, { requireJourneys: true });
    expect(run1).toEqual(run2);
  });

  it('rejects unauthorized signers when an authorizedSigners list is enforced', () => {
    const signoff = {
      ...passingSignoff,
      journeys: {
        ...passingJourneys,
        funding: { ...passingGate, signedOffBy: 'unauthorized-contributor' },
      },
    };
    const result = validateReleaseSignoff(signoff, {
      requireJourneys: true,
      authorizedSigners: ['release-manager', 'governance-lead'],
    });
    expect(result.ok).toBe(false);
    expect(result.problems).toContainEqual({
      gate: 'funding',
      message: 'signer "unauthorized-contributor" is not in the authorized signers list',
    });
  });

  it('rejects stale sign-off timestamps exceeding maxAgeMs', () => {
    const oldTimestamp = new Date(Date.now() - 40 * 86_400 * 1000).toISOString();
    const staleSignoff = {
      ...passingSignoff,
      journeys: {
        ...passingJourneys,
        settlement: { ...passingGate, signedOffAt: oldTimestamp },
      },
    };
    const result = validateReleaseSignoff(staleSignoff, {
      requireJourneys: true,
      maxAgeMs: 30 * 86_400 * 1000, // 30 days
      now: Date.now(),
    });
    expect(result.ok).toBe(false);
    expect(
      result.problems.some((p) => p.gate === 'settlement' && p.message.includes('stale'))
    ).toBe(true);
  });

  it('rejects future timestamps beyond allowable clock skew', () => {
    const futureTimestamp = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const futureSignoff = {
      ...passingSignoff,
      journeys: {
        ...passingJourneys,
        claim: { ...passingGate, signedOffAt: futureTimestamp },
      },
    };
    const result = validateReleaseSignoff(futureSignoff, {
      requireJourneys: true,
      now: Date.now(),
    });
    expect(result.ok).toBe(false);
    expect(result.problems).toContainEqual({
      gate: 'claim',
      message: 'signedOffAt cannot be in the future',
    });
  });

  it('supports kebab-case alias for governance-mutation', () => {
    const kebabJourneys = {
      funding: passingGate,
      settlement: passingGate,
      cancel: passingGate,
      claim: passingGate,
      'governance-mutation': passingGate,
    };
    const result = validateMutationJourneys(kebabJourneys);
    expect(result.ok).toBe(true);
    expect(result.problems).toHaveLength(0);
  });
});
