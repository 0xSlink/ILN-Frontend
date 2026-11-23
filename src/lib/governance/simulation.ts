/**
 * Governance write simulation gate (#1063).
 *
 * Soroban transactions are simulated before a wallet is asked to sign them.
 * When the simulation fails there is nothing to sign: the failure must be
 * rendered to the user and the wallet prompt must never open. Running the
 * simulation first also guarantees that a rejected simulation cannot mutate
 * local governance state or invalidate query caches.
 *
 * ## Preview provenance (#1322)
 *
 * The proposal form's effect preview is separate from the transaction gate:
 *
 * - `contract-rpc`: an RPC simulation bound to this exact payload. It expires
 *   after {@link GOVERNANCE_PREVIEW_MAX_AGE_MS}.
 * - `client-estimate`: text computed in the browser. It proves nothing about
 *   contract acceptance and is never labeled as verified.
 *
 * A preview is shown only for the payload that produced it. Edited, expired,
 * failed, or unproven results are withheld. Submission does not trust previews:
 * `create_proposal` is always simulated again before the wallet opens.
 */

/** Stable error code consumed by callers / telemetry. */
export const GOVERNANCE_SIMULATION_FAILED = 'GOVERNANCE_SIMULATION_FAILED';

/**
 * Result of a governance dry-run. `success: true` is the only outcome that
 * allows signing; everything else is surfaced as a simulation failure.
 */
export interface GovernanceSimulationOutcome {
  success: boolean;
  /** Contract / RPC diagnostic shown to the user. */
  error?: string;
}

/** Thrown before any signature request when a governance simulation fails. */
export class GovernanceSimulationError extends Error {
  readonly code = GOVERNANCE_SIMULATION_FAILED;

  constructor(detail?: string, options?: { cause?: unknown }) {
    super(
      `${GOVERNANCE_SIMULATION_FAILED}: ${
        detail && detail.trim().length > 0
          ? detail
          : 'The governance transaction failed simulation and was not submitted.'
      }`,
      options
    );
    this.name = 'GovernanceSimulationError';
  }
}

/** True for a simulation failure produced by this module. */
export function isGovernanceSimulationError(error: unknown): error is GovernanceSimulationError {
  return error instanceof GovernanceSimulationError;
}

/**
 * Run a governance dry-run and throw a typed error when it does not succeed.
 *
 * Callers must invoke this before `signTx`. A thrown error therefore means the
 * wallet prompt was never opened and no state was mutated.
 */
export async function assertGovernanceSimulationPassed(
  simulate: () => Promise<GovernanceSimulationOutcome>
): Promise<void> {
  let outcome: GovernanceSimulationOutcome;
  try {
    outcome = await simulate();
  } catch (error) {
    throw new GovernanceSimulationError('Simulation could not be completed.', { cause: error });
  }

  if (outcome?.success !== true) {
    throw new GovernanceSimulationError(outcome?.error);
  }
}

// ─── Preview provenance (#1322) ───────────────────────────────────────────────

export type GovernancePreviewProvenance = 'contract-rpc' | 'client-estimate';

export const GOVERNANCE_PREVIEW_MAX_AGE_MS = 30_000;

export interface GovernancePreviewResult {
  isContractVerified: boolean;
  provenance?: GovernancePreviewProvenance;
}

export interface StampedGovernancePreview<T extends GovernancePreviewResult> {
  result: T;
  fingerprint: string;
  observedAt: number;
}

/** Stable identity for a payload; object key order does not affect it. */
export function governancePreviewFingerprint(payload: object): string {
  const entries = Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(entries);
}

export function stampGovernancePreview<T extends GovernancePreviewResult>(
  result: T,
  fingerprint: string,
  observedAt = Date.now()
): StampedGovernancePreview<T> {
  return { result, fingerprint, observedAt };
}

/** Returns the preview only while it is valid for the current payload. */
export function currentGovernancePreview<T extends GovernancePreviewResult>(
  preview: StampedGovernancePreview<T> | null,
  fingerprint: string | null,
  now = Date.now()
): T | null {
  if (!preview || preview.fingerprint !== fingerprint) return null;
  if (preview.result.isContractVerified) {
    if (preview.result.provenance !== 'contract-rpc') return null;
    if (now - preview.observedAt > GOVERNANCE_PREVIEW_MAX_AGE_MS) return null;
  }
  return preview.result;
}
