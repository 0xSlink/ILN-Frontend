import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIGNOFF_GATES, validateReleaseSignoff } from '../release-signoff';

const passingGate = {
  status: 'passed',
  evidence: 'https://github.com/Invoice-Liquidity-Network/ILN-Frontend/actions/runs/1',
  signedOffBy: 'release-manager',
  signedOffAt: '2026-10-15T10:00:00Z',
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
    expect(result.problems).toContainEqual({ gate: 'indexer', message: 'gate sign-off is missing' });
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
});
