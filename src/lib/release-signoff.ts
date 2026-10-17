/**
 * Release sign-off gate for frontend trust surfaces (#1158).
 *
 * A release is signed off only when governance, wallet, indexer, and
 * accessibility gates each have a passing result, a named signer, and
 * evidence (a CI run URL or repo path). The release sheet lives at
 * `docs/release/signoff.json` and is validated by this module's tests.
 */

export const SIGNOFF_GATES = ['governance', 'wallet', 'indexer', 'accessibility'] as const;

export type SignoffGate = (typeof SIGNOFF_GATES)[number];

export interface GateSignoff {
  status: 'passed' | 'failed' | 'pending';
  /** CI run URL, test report, or repo path that proves the gate passed. */
  evidence: string;
  signedOffBy: string;
  /** ISO 8601 timestamp of the sign-off. */
  signedOffAt: string;
}

export interface ReleaseSignoff {
  release: string;
  gates: Record<SignoffGate, GateSignoff>;
}

export interface SignoffProblem {
  gate: SignoffGate | 'release';
  message: string;
}

export interface SignoffValidation {
  ok: boolean;
  problems: SignoffProblem[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateReleaseSignoff(input: unknown): SignoffValidation {
  const problems: SignoffProblem[] = [];

  if (!isRecord(input)) {
    return { ok: false, problems: [{ gate: 'release', message: 'sign-off must be an object' }] };
  }

  if (!isNonEmptyString(input.release)) {
    problems.push({ gate: 'release', message: 'release identifier is required' });
  }

  const gates = isRecord(input.gates) ? input.gates : {};
  for (const gate of SIGNOFF_GATES) {
    const entry = gates[gate];
    if (!isRecord(entry)) {
      problems.push({ gate, message: 'gate sign-off is missing' });
      continue;
    }
    if (entry.status !== 'passed') {
      problems.push({ gate, message: `status must be "passed" (found "${String(entry.status)}")` });
    }
    if (!isNonEmptyString(entry.evidence)) {
      problems.push({ gate, message: 'evidence is required' });
    }
    if (!isNonEmptyString(entry.signedOffBy)) {
      problems.push({ gate, message: 'signedOffBy is required' });
    }
    if (!isNonEmptyString(entry.signedOffAt) || Number.isNaN(Date.parse(entry.signedOffAt))) {
      problems.push({ gate, message: 'signedOffAt must be an ISO 8601 timestamp' });
    }
  }

  return { ok: problems.length === 0, problems };
}
