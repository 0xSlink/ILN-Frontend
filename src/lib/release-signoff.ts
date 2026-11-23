/**
 * Release sign-off gate for frontend trust surfaces (#1158, #1160).
 *
 * A release is signed off only when governance, wallet, indexer, and
 * accessibility gates each have a passing result, a named signer, and
 * evidence (a CI run URL or repo path).
 *
 * Extended to mutation journeys: funding, settlement, cancel, claim,
 * and governance mutation journeys.
 *
 * The release sheet lives at `docs/release/signoff.json` and is validated
 * by this module's tests and release tooling.
 */

export const SIGNOFF_GATES = ['governance', 'wallet', 'indexer', 'accessibility'] as const;

export type SignoffGate = (typeof SIGNOFF_GATES)[number];

export const MUTATION_JOURNEYS = [
  'funding',
  'settlement',
  'cancel',
  'claim',
  'governance_mutation',
] as const;

export type MutationJourney = (typeof MUTATION_JOURNEYS)[number];

export type SignoffTarget = SignoffGate | MutationJourney | 'governance-mutation' | 'release';

export interface GateSignoff {
  status: 'passed' | 'failed' | 'pending';
  /** CI run URL, test report, or repo path that proves the gate passed. */
  evidence: string;
  signedOffBy: string;
  /** ISO 8601 timestamp of the sign-off. */
  signedOffAt: string;
  /** Optional transaction hash or identifier demonstrating execution on testnet/sandbox. */
  verifiedTxHash?: string;
}

export interface ReleaseSignoff {
  release: string;
  gates: Record<SignoffGate, GateSignoff>;
  journeys?: Partial<Record<MutationJourney | 'governance-mutation', GateSignoff>>;
}

export interface SignoffProblem {
  gate: SignoffTarget;
  message: string;
}

export interface SignoffValidation {
  ok: boolean;
  problems: SignoffProblem[];
}

export interface ValidateSignoffOptions {
  /** When true, requires all mutation journeys to be present and passed. */
  requireJourneys?: boolean;
  /** Optional allowlist of authorized signers. When provided, any signer outside this list is rejected. */
  authorizedSigners?: string[];
  /** Optional maximum allowed age in milliseconds for sign-offs. Stale sign-offs are rejected. */
  maxAgeMs?: number;
  /** Current reference timestamp in ms (defaults to Date.now()). */
  now?: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates a single gate or journey sign-off entry.
 */
export function validateSignoffEntry(
  target: SignoffTarget,
  entry: unknown,
  options: ValidateSignoffOptions = {}
): SignoffProblem[] {
  const problems: SignoffProblem[] = [];

  if (!isRecord(entry)) {
    return [{ gate: target, message: 'gate sign-off is missing' }];
  }

  if (entry.status !== 'passed') {
    problems.push({
      gate: target,
      message: `status must be "passed" (found "${String(entry.status)}")`,
    });
  }

  if (!isNonEmptyString(entry.evidence)) {
    problems.push({ gate: target, message: 'evidence is required' });
  }

  if (!isNonEmptyString(entry.signedOffBy)) {
    problems.push({ gate: target, message: 'signedOffBy is required' });
  } else if (
    options.authorizedSigners &&
    options.authorizedSigners.length > 0 &&
    !options.authorizedSigners.includes(entry.signedOffBy)
  ) {
    problems.push({
      gate: target,
      message: `signer "${entry.signedOffBy}" is not in the authorized signers list`,
    });
  }

  if (!isNonEmptyString(entry.signedOffAt) || Number.isNaN(Date.parse(entry.signedOffAt))) {
    problems.push({ gate: target, message: 'signedOffAt must be an ISO 8601 timestamp' });
  } else {
    const timestampMs = Date.parse(entry.signedOffAt);
    const now = options.now ?? Date.now();

    // Stale check (if maxAgeMs configured)
    if (typeof options.maxAgeMs === 'number' && options.maxAgeMs > 0) {
      if (now - timestampMs > options.maxAgeMs) {
        problems.push({
          gate: target,
          message: `sign-off is stale (${Math.round((now - timestampMs) / 1000)}s old, max allowed is ${Math.round(options.maxAgeMs / 1000)}s)`,
        });
      }
    }

    // Future timestamp check (allowing 60s clock skew)
    if (timestampMs > now + 60_000) {
      problems.push({
        gate: target,
        message: 'signedOffAt cannot be in the future',
      });
    }
  }

  return problems;
}

/**
 * Validates mutation journeys independently.
 */
export function validateMutationJourneys(
  journeys: unknown,
  options: ValidateSignoffOptions = {}
): SignoffValidation {
  const problems: SignoffProblem[] = [];

  if (!isRecord(journeys)) {
    return {
      ok: false,
      problems: [{ gate: 'release', message: 'mutation journeys must be an object' }],
    };
  }

  for (const journey of MUTATION_JOURNEYS) {
    // Also accept kebab-case alias for governance-mutation
    const entry =
      journeys[journey] ??
      (journey === 'governance_mutation' ? journeys['governance-mutation'] : undefined);

    problems.push(...validateSignoffEntry(journey, entry, options));
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Validates a release sign-off sheet against required trust gates and mutation journeys.
 */
export function validateReleaseSignoff(
  input: unknown,
  options: ValidateSignoffOptions = {}
): SignoffValidation {
  const problems: SignoffProblem[] = [];

  if (!isRecord(input)) {
    return { ok: false, problems: [{ gate: 'release', message: 'sign-off must be an object' }] };
  }

  if (!isNonEmptyString(input.release)) {
    problems.push({ gate: 'release', message: 'release identifier is required' });
  }

  const gates = isRecord(input.gates) ? input.gates : {};
  for (const gate of SIGNOFF_GATES) {
    problems.push(...validateSignoffEntry(gate, gates[gate], options));
  }

  // Validate mutation journeys if present in input or explicitly required
  const hasJourneys = isRecord(input.journeys);
  const requireJourneys = options.requireJourneys ?? hasJourneys;

  if (requireJourneys) {
    const journeyResult = validateMutationJourneys(input.journeys ?? {}, options);
    problems.push(...journeyResult.problems);
  }

  return { ok: problems.length === 0, problems };
}
