/**
 * @file journey-recovery-slos.test.ts
 *
 * Guards the critical-journey recovery SLOs (#1160). Covers the four
 * interruption scenarios (auth, RPC, indexer, wallet), asserts that measured
 * durations are derived from the tracker's clock (never fabricated), that
 * budgets block regressions, and that every recovery emits telemetry.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RECOVERY_SLO_BUDGETS,
  RECOVERY_SLO_BUDGET_CEILINGS_MS,
  JOURNEY_RECOVERY_EVENT,
  RecoverySloTracker,
  evaluateRecovery,
  journeyRecovery,
  type JourneyKey,
} from '../journey-recovery-slos';
import { trackEvent } from '@/lib/analytics';

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

const mockedTrackEvent = vi.mocked(trackEvent);

const ALL_JOURNEYS: JourneyKey[] = ['auth', 'rpc', 'indexer', 'wallet'];

describe('RECOVERY_SLO_BUDGETS', () => {
  it('defines a budget for every critical journey', () => {
    for (const journey of ALL_JOURNEYS) {
      expect(RECOVERY_SLO_BUDGETS[journey]).toBeDefined();
      expect(RECOVERY_SLO_BUDGETS[journey].budgetMs).toBeGreaterThan(0);
      expect(RECOVERY_SLO_BUDGETS[journey].description.length).toBeGreaterThan(0);
    }
  });

  it('blocks regressions: budgets never exceed their hard ceilings', () => {
    for (const journey of ALL_JOURNEYS) {
      expect(RECOVERY_SLO_BUDGETS[journey].budgetMs).toBeLessThanOrEqual(
        RECOVERY_SLO_BUDGET_CEILINGS_MS[journey]
      );
    }
  });
});

describe('evaluateRecovery', () => {
  it('marks a within-budget recovery', () => {
    const m = evaluateRecovery('wallet', 'silent_reconnect', 1_000, 1_000 + 5_000);
    expect(m.durationMs).toBe(5_000);
    expect(m.status).toBe('recovered');
    expect(m.budgetMs).toBe(RECOVERY_SLO_BUDGETS.wallet.budgetMs);
  });

  it('marks a breach when the interruption outlives the budget', () => {
    const m = evaluateRecovery(
      'indexer',
      'websocket',
      0,
      RECOVERY_SLO_BUDGETS.indexer.budgetMs + 1
    );
    expect(m.status).toBe('breached');
  });

  it('derives duration from the supplied timestamps, not a guess', () => {
    const m = evaluateRecovery('rpc', 'horizon_stream', 12_345, 12_345 + 7_777);
    expect(m.durationMs).toBe(7_777);
    expect(m.startedAt).toBe(12_345);
    expect(m.recoveredAt).toBe(12_345 + 7_777);
  });

  it('clamps a negative duration to zero', () => {
    const m = evaluateRecovery('auth', 'access_denied', 5_000, 4_000);
    expect(m.durationMs).toBe(0);
  });
});

describe('RecoverySloTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedTrackEvent.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('measures the wallet silent-reconnect journey and emits telemetry', () => {
    const tracker = new RecoverySloTracker();
    tracker.markInterruption('wallet', 'silent_reconnect');
    vi.advanceTimersByTime(3_000);
    const m = tracker.markRecovered('wallet');

    expect(m).not.toBeNull();
    expect(m!.durationMs).toBe(3_000);
    expect(m!.status).toBe('recovered');
    expect(mockedTrackEvent).toHaveBeenCalledWith(
      JOURNEY_RECOVERY_EVENT,
      expect.objectContaining({
        journey: 'wallet',
        scenario: 'silent_reconnect',
        durationMs: 3_000,
      })
    );
  });

  it('measures the auth authorization journey across a denial then a grant', () => {
    const tracker = new RecoverySloTracker();
    tracker.markInterruption('auth', 'access_denied');
    vi.advanceTimersByTime(2_500);
    const m = tracker.markRecovered('auth');
    expect(m!.durationMs).toBe(2_500);
    expect(m!.journey).toBe('auth');
  });

  it('measures the rpc stream journey', () => {
    const tracker = new RecoverySloTracker();
    tracker.markInterruption('rpc', 'horizon_stream');
    vi.advanceTimersByTime(9_000);
    const m = tracker.markRecovered('rpc');
    expect(m!.durationMs).toBe(9_000);
    expect(m!.status).toBe('recovered');
  });

  it('measures the indexer websocket journey', () => {
    const tracker = new RecoverySloTracker();
    tracker.markInterruption('indexer', 'websocket');
    vi.advanceTimersByTime(1_200);
    const m = tracker.markRecovered('indexer');
    expect(m!.durationMs).toBe(1_200);
    expect(m!.scenario).toBe('websocket');
  });

  it('flags a breach when recovery exceeds the journey budget', () => {
    const tracker = new RecoverySloTracker();
    tracker.markInterruption('indexer', 'websocket');
    vi.advanceTimersByTime(RECOVERY_SLO_BUDGETS.indexer.budgetMs + 500);
    const m = tracker.markRecovered('indexer');

    expect(m!.status).toBe('breached');
    expect(mockedTrackEvent).toHaveBeenCalledWith(
      JOURNEY_RECOVERY_EVENT,
      expect.objectContaining({ journey: 'indexer', status: 'breached', breached: true })
    );
  });

  it('keeps the original start when interruptions repeat during an outage', () => {
    const tracker = new RecoverySloTracker();
    tracker.markInterruption('indexer', 'websocket');
    vi.advanceTimersByTime(1_000);
    tracker.markInterruption('indexer', 'websocket');
    vi.advanceTimersByTime(1_000);
    const m = tracker.markRecovered('indexer');
    expect(m!.durationMs).toBe(2_000);
  });

  it('never fabricates a measurement without a preceding interruption', () => {
    const tracker = new RecoverySloTracker();
    expect(tracker.markRecovered('wallet')).toBeNull();
    expect(mockedTrackEvent).not.toHaveBeenCalled();
    expect(tracker.isInterrupted('wallet')).toBe(false);
  });

  it('clear abandons a window without emitting', () => {
    const tracker = new RecoverySloTracker();
    tracker.markInterruption('wallet', 'silent_reconnect');
    expect(tracker.isInterrupted('wallet')).toBe(true);
    tracker.clear('wallet');
    expect(tracker.isInterrupted('wallet')).toBe(false);
    expect(tracker.markRecovered('wallet')).toBeNull();
    expect(mockedTrackEvent).not.toHaveBeenCalled();
  });

  it('tracks each journey independently', () => {
    const tracker = new RecoverySloTracker();
    tracker.markInterruption('rpc', 'horizon_stream');
    tracker.markInterruption('indexer', 'websocket');
    vi.advanceTimersByTime(1_000);
    expect(tracker.markRecovered('rpc')!.durationMs).toBe(1_000);
    vi.advanceTimersByTime(1_000);
    expect(tracker.markRecovered('indexer')!.durationMs).toBe(2_000);
  });
});

describe('app-wide tracker', () => {
  beforeEach(() => {
    journeyRecovery.reset();
    mockedTrackEvent.mockClear();
  });

  it('is exported and resettable for isolated measurements', () => {
    expect(journeyRecovery).toBeInstanceOf(RecoverySloTracker);
    journeyRecovery.markInterruption('wallet', 'silent_reconnect');
    journeyRecovery.reset();
    expect(journeyRecovery.isInterrupted('wallet')).toBe(false);
  });
});
