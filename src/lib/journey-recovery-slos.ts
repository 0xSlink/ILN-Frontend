'use client';

/**
 * Critical-journey recovery SLOs (#1160).
 *
 * Tracks how long the app stays broken between the moment a critical journey is
 * interrupted (auth, RPC, indexer, wallet) and the moment it is recovered.
 * Every recovery emits a `journey_recovery` analytics event carrying a real,
 * timestamp-derived duration so operators can measure the baseline and watch for
 * regressions. Durations are never fabricated: a measurement only exists when an
 * interruption was actually observed and later recovered.
 *
 * Budgets live in {@link RECOVERY_SLO_BUDGETS}; the Vitest suite
 * (`src/lib/__tests__/journey-recovery-slos.test.ts`) enforces them so a
 * regression that inflates a budget fails CI. See
 * `docs/frontend-trust-surface-rollback-runbook.md` for the rollback/evidence
 * path.
 */

import { trackEvent } from '@/lib/analytics';

/** The critical user journeys whose recovery time we measure. */
export type JourneyKey = 'auth' | 'rpc' | 'indexer' | 'wallet';

/** Telemetry event name emitted on every measured recovery. */
export const JOURNEY_RECOVERY_EVENT = 'journey_recovery';

export interface RecoverySloBudget {
  /** Maximum tolerated time (ms) between an interruption and its recovery. */
  readonly budgetMs: number;
  /** Human description used in dashboards and the rollback runbook. */
  readonly description: string;
}

/**
 * Per-journey recovery budgets. These are the values CI enforces — raise one
 * only alongside a documented product decision (see the runbook), because the
 * unit test asserts every budget stays within a hard ceiling.
 */
export const RECOVERY_SLO_BUDGETS: Readonly<Record<JourneyKey, RecoverySloBudget>> = {
  auth: {
    budgetMs: 15_000,
    description: 'Freighter authorization granted after an earlier denial.',
  },
  rpc: {
    budgetMs: 20_000,
    description: 'Horizon/RPC data-plane stream re-established after an interruption.',
  },
  indexer: {
    budgetMs: 20_000,
    description: 'Indexer event stream re-established after an interruption.',
  },
  wallet: {
    budgetMs: 10_000,
    description: 'Stored wallet session restored after an interruption.',
  },
} as const;

/** Hard ceilings used by the regression test to stop budgets being inflated. */
export const RECOVERY_SLO_BUDGET_CEILINGS_MS: Readonly<Record<JourneyKey, number>> = {
  auth: 15_000,
  rpc: 30_000,
  indexer: 30_000,
  wallet: 20_000,
} as const;

export type RecoverySloStatus = 'recovered' | 'breached';

export interface RecoveryMeasurement {
  journey: JourneyKey;
  scenario: string;
  /** Real elapsed time derived from the tracker's clock. */
  durationMs: number;
  budgetMs: number;
  status: RecoverySloStatus;
  startedAt: number;
  recoveredAt: number;
}

interface PendingInterruption {
  startedAt: number;
  scenario: string;
}

/**
 * Pure evaluation of a completed interruption → recovery cycle. Exported so the
 * regression test can assert budget behaviour without any global state.
 */
export function evaluateRecovery(
  journey: JourneyKey,
  scenario: string,
  startedAt: number,
  recoveredAt: number
): RecoveryMeasurement {
  const budgetMs = RECOVERY_SLO_BUDGETS[journey].budgetMs;
  const durationMs = Math.max(0, recoveredAt - startedAt);
  return {
    journey,
    scenario,
    durationMs,
    budgetMs,
    status: durationMs <= budgetMs ? 'recovered' : 'breached',
    startedAt,
    recoveredAt,
  };
}

function emitMeasurement(measurement: RecoveryMeasurement): void {
  try {
    trackEvent(JOURNEY_RECOVERY_EVENT, {
      journey: measurement.journey,
      scenario: measurement.scenario,
      durationMs: measurement.durationMs,
      budgetMs: measurement.budgetMs,
      status: measurement.status,
      breached: measurement.status === 'breached',
      startedAt: measurement.startedAt,
      recoveredAt: measurement.recoveredAt,
    });
  } catch {
    // Telemetry must never break the journey it is measuring.
  }
}

/**
 * Tracks interruption → recovery cycles per journey.
 *
 * A first `markInterruption` opens a window; repeated interruptions while a
 * window is already open are ignored so the duration reflects the original
 * outage. `markRecovered` closes the window and emits a measurement (or returns
 * `null` if there was nothing to recover — never a phantom measurement).
 */
export class RecoverySloTracker {
  private readonly pending = new Map<JourneyKey, PendingInterruption>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** Opens (or keeps) an interruption window for the journey. */
  markInterruption(journey: JourneyKey, scenario = 'interruption'): void {
    if (this.pending.has(journey)) return;
    this.pending.set(journey, { startedAt: this.now(), scenario });
  }

  /** Closes an open window and emits the recovery measurement, if any. */
  markRecovered(journey: JourneyKey): RecoveryMeasurement | null {
    const pending = this.pending.get(journey);
    if (!pending) return null;
    this.pending.delete(journey);
    const measurement = evaluateRecovery(journey, pending.scenario, pending.startedAt, this.now());
    emitMeasurement(measurement);
    return measurement;
  }

  /** Abandons an open window without emitting (e.g. the journey gave up). */
  clear(journey: JourneyKey): void {
    this.pending.delete(journey);
  }

  isInterrupted(journey: JourneyKey): boolean {
    return this.pending.has(journey);
  }

  reset(): void {
    this.pending.clear();
  }
}

/** App-wide tracker. The clock is `Date.now`, so tests can drive it with fake timers. */
export const journeyRecovery = new RecoverySloTracker();
