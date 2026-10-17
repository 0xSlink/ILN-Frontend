/**
 * Shared test helper for detecting mock-backed contract-integration functions
 * (issue #857).
 *
 * Several governance functions were closed as "implemented" while still
 * returning `Math.random()`-derived transaction hashes and never touching the
 * network. A standalone CI scan can catch the source pattern, but this helper
 * lets each function's *own* test file assert on observed behaviour, so a
 * regression back to a mock fails next to the function it affects.
 *
 * Two behavioural signals are checked:
 *
 * 1. Identifier provenance: `Math.random` is replaced with a seeded PRNG and
 *    the function is run three times (seed A, seed A again, seed B). If the
 *    returned identifier is stable under a fixed seed but changes when only
 *    the seed changes, it is derived from `Math.random()`. If it changes even
 *    under the same seed, it comes from some other non-deterministic source
 *    (`Date.now()`, `crypto.randomUUID()`, …) — a real call against a
 *    deterministically mocked transport would not do that either.
 *
 * 2. Boundary usage: callers pass spies for the boundaries a real
 *    implementation must cross (the `signTx` callback, the Soroban RPC
 *    `simulateTransaction`/`sendTransaction`, `fetch`, …). Any boundary that
 *    was never called during the runs is reported.
 *
 * Usage:
 *
 * ```ts
 * const report = await detectMockBacking({
 *   run: () => castVote(1, 'For', SIGNER, signTx),
 *   boundaries: { signTx },
 * });
 * expectMockBackingStatus('castVote', report, 'real');
 * ```
 */
import { vi } from 'vitest';

/** Minimal shape of a Vitest spy/mock; avoids coupling to a Vitest type export. */
export interface CallRecorder {
  mock: { calls: unknown[][] };
}

export interface MockDetectionOptions<T> {
  /**
   * Invokes the function under test once. Called three times, so it must not
   * depend on state left behind by a previous invocation for its identifier.
   * If the function waits on timers, advance fake timers inside `run`.
   */
  run: () => Promise<T> | T;
  /**
   * Extracts the identifier to examine (tx hash, proposal id, …) from the
   * result. Defaults to the result itself. Return `undefined` to skip the
   * provenance check (e.g. for read paths that return no identifier).
   */
  identify?: (result: T) => unknown;
  /**
   * Spies on boundaries a real implementation must cross. Each one is
   * expected to be called at least once across the runs.
   */
  boundaries?: Record<string, CallRecorder>;
  /** Seeds for the two PRNG streams. Only need overriding in edge cases. */
  seeds?: readonly [number, number];
}

export interface MockDetectionReport {
  /** Serialised identifiers observed for seed A, seed A (repeat) and seed B. */
  identifiers: [string | undefined, string | undefined, string | undefined];
  /** Number of `Math.random()` calls made across all runs. */
  mathRandomCalls: number;
  /** Identifier is a function of `Math.random()` output. */
  identifierFromMathRandom: boolean;
  /** Identifier differs between runs with the same seed. */
  identifierNondeterministic: boolean;
  /** Names of `boundaries` that were never called. */
  boundariesNotCalled: string[];
  /** True if any signal above indicates a mock-backed implementation. */
  mockBacked: boolean;
  /** Human-readable reasons behind `mockBacked`. */
  reasons: string[];
}

export type MockBackingStatus = 'mock' | 'real';

/**
 * Merges several spies into one boundary, satisfied if any of them is called.
 * Useful for read paths that may legitimately reach the network through
 * either Soroban RPC or `fetch`.
 */
export function combineRecorders(...recorders: CallRecorder[]): CallRecorder {
  return {
    mock: {
      get calls() {
        return recorders.flatMap((r) => r.mock.calls);
      },
    },
  };
}

/** Small, fast, seedable PRNG (mulberry32) returning values in [0, 1). */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function serialiseIdentifier(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? `${v}n` : v));
}

async function runWithSeed<T>(
  options: MockDetectionOptions<T>,
  seed: number
): Promise<{ identifier: string | undefined; randomCalls: number }> {
  const random = createSeededRandom(seed);
  const spy = vi.spyOn(Math, 'random').mockImplementation(random);
  try {
    const result = await options.run();
    const identify = options.identify ?? ((r: T) => r);
    return {
      identifier: serialiseIdentifier(identify(result)),
      randomCalls: spy.mock.calls.length,
    };
  } finally {
    spy.mockRestore();
  }
}

/**
 * Runs the function under test and reports whether its behaviour looks
 * mock-backed. Never throws on a mock verdict; use
 * {@link expectNotMockBacked} or {@link expectMockBackingStatus} to assert.
 */
export async function detectMockBacking<T>(
  options: MockDetectionOptions<T>
): Promise<MockDetectionReport> {
  const [seedA, seedB] = options.seeds ?? [0x1f2e3d4c, 0x5a6b7c8d];
  if (seedA === seedB) {
    throw new Error('detectMockBacking: the two seeds must differ');
  }

  const boundaryCallsBefore = Object.fromEntries(
    Object.entries(options.boundaries ?? {}).map(([name, spy]) => [name, spy.mock.calls.length])
  );

  const first = await runWithSeed(options, seedA);
  const repeat = await runWithSeed(options, seedA);
  const other = await runWithSeed(options, seedB);

  const identifiers: MockDetectionReport['identifiers'] = [
    first.identifier,
    repeat.identifier,
    other.identifier,
  ];
  const hasIdentifier = identifiers.every((id) => id !== undefined);
  const identifierNondeterministic = hasIdentifier && first.identifier !== repeat.identifier;
  const identifierFromMathRandom =
    hasIdentifier && !identifierNondeterministic && first.identifier !== other.identifier;

  const boundariesNotCalled = Object.entries(options.boundaries ?? {})
    .filter(([name, spy]) => spy.mock.calls.length <= boundaryCallsBefore[name])
    .map(([name]) => name);

  const reasons: string[] = [];
  if (identifierFromMathRandom) {
    reasons.push(
      `returned identifier changes with the Math.random() seed ` +
        `(seed A: ${first.identifier}, seed B: ${other.identifier})`
    );
  }
  if (identifierNondeterministic) {
    reasons.push(
      `returned identifier is non-deterministic under a fixed seed ` +
        `(${first.identifier} vs ${repeat.identifier}); likely Date.now()/crypto-derived`
    );
  }
  for (const name of boundariesNotCalled) {
    reasons.push(`boundary "${name}" was never called`);
  }

  return {
    identifiers,
    mathRandomCalls: first.randomCalls + repeat.randomCalls + other.randomCalls,
    identifierFromMathRandom,
    identifierNondeterministic,
    boundariesNotCalled,
    mockBacked: reasons.length > 0,
    reasons,
  };
}

/** Throws with a descriptive message if the report indicates mock backing. */
export function expectNotMockBacked(name: string, report: MockDetectionReport): void {
  if (report.mockBacked) {
    throw new Error(
      `${name} appears to be mock-backed:\n` + report.reasons.map((r) => `  - ${r}`).join('\n')
    );
  }
}

/**
 * Asserts the observed behaviour matches the status recorded in the test.
 *
 * Recording `'mock'` for a function that is still a stub keeps the suite
 * green while making the status explicit; once a real implementation lands
 * the assertion fails and asks for the status to be flipped to `'real'`,
 * after which any regression back to a mock fails the build.
 */
export function expectMockBackingStatus(
  name: string,
  report: MockDetectionReport,
  expected: MockBackingStatus
): void {
  if (expected === 'real') {
    expectNotMockBacked(name, report);
    return;
  }
  if (!report.mockBacked) {
    throw new Error(
      `${name} no longer appears to be mock-backed. If a real implementation ` +
        `has landed, change its expected status from 'mock' to 'real' in this ` +
        `test so a future regression to a mock is caught.`
    );
  }
}
