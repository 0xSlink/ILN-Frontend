import { describe, expect, it, vi } from 'vitest';
import {
  combineRecorders,
  createSeededRandom,
  detectMockBacking,
  expectMockBackingStatus,
  expectNotMockBacked,
} from '../mock-detection';

// Synthetic stand-ins for the shapes seen in src/utils/governance.ts.
async function mockTxHash(): Promise<string> {
  return Math.random().toString(16).substring(2, 18);
}

async function mockHexHash(): Promise<string> {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function makeRealWrite(signTx: (xdr: string) => Promise<string>) {
  return async (): Promise<string> => {
    // Unrelated Math.random use (e.g. retry jitter) must not trip detection.
    void Math.random();
    const signed = await signTx('AAAA-unsigned-xdr');
    return `hash-of-${signed}`;
  };
}

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed and values in [0, 1)', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces a different sequence for a different seed', () => {
    expect(createSeededRandom(1)()).not.toBe(createSeededRandom(2)());
  });
});

describe('detectMockBacking', () => {
  it('flags an identifier built from Math.random().toString(16)', async () => {
    const report = await detectMockBacking({ run: mockTxHash });
    expect(report.identifierFromMathRandom).toBe(true);
    expect(report.identifierNondeterministic).toBe(false);
    expect(report.mockBacked).toBe(true);
    expect(report.mathRandomCalls).toBeGreaterThanOrEqual(3);
    expect(report.identifiers[0]).toBe(report.identifiers[1]);
    expect(report.identifiers[0]).not.toBe(report.identifiers[2]);
  });

  it('flags a per-character Math.random() hex hash', async () => {
    const report = await detectMockBacking({ run: mockHexHash });
    expect(report.identifierFromMathRandom).toBe(true);
  });

  it('flags an identifier nested in an object via `identify`', async () => {
    const report = await detectMockBacking({
      run: async () => ({ proposalId: 7, txHash: await mockTxHash() }),
      identify: (r) => r.txHash,
    });
    expect(report.identifierFromMathRandom).toBe(true);
  });

  it('flags a non-deterministic identifier that bypasses Math.random', async () => {
    let counter = 0;
    const report = await detectMockBacking({ run: async () => `tx-${Date.now()}-${counter++}` });
    expect(report.identifierFromMathRandom).toBe(false);
    expect(report.identifierNondeterministic).toBe(true);
    expect(report.mockBacked).toBe(true);
  });

  it('passes a deterministic identifier derived from the signer, even if Math.random is used elsewhere', async () => {
    const signTx = vi.fn(async (xdr: string) => `signed(${xdr})`);
    const report = await detectMockBacking({ run: makeRealWrite(signTx), boundaries: { signTx } });
    expect(report.mathRandomCalls).toBe(3);
    expect(report.identifierFromMathRandom).toBe(false);
    expect(report.identifierNondeterministic).toBe(false);
    expect(report.boundariesNotCalled).toEqual([]);
    expect(report.mockBacked).toBe(false);
    expect(signTx).toHaveBeenCalledTimes(3);
  });

  it('reports boundaries that were never called', async () => {
    const signTx = vi.fn();
    const simulate = vi.fn();
    const report = await detectMockBacking({
      run: async () => 'constant',
      boundaries: { signTx, simulate },
    });
    expect(report.boundariesNotCalled).toEqual(['signTx', 'simulate']);
    expect(report.mockBacked).toBe(true);
    expect(report.reasons).toContain('boundary "signTx" was never called');
  });

  it('only counts boundary calls made during detection', async () => {
    const signTx = vi.fn();
    signTx('called before detection');
    const report = await detectMockBacking({ run: async () => 'constant', boundaries: { signTx } });
    expect(report.boundariesNotCalled).toEqual(['signTx']);
  });

  it('treats a combined boundary as called when any member spy is called', async () => {
    const simulate = vi.fn();
    const fetchSpy = vi.fn();
    const report = await detectMockBacking({
      run: async () => {
        fetchSpy();
        return 'constant';
      },
      boundaries: { network: combineRecorders(simulate, fetchSpy) },
    });
    expect(report.boundariesNotCalled).toEqual([]);
  });

  it('skips the provenance check when `identify` returns undefined', async () => {
    const fetchSpy = vi.fn();
    const report = await detectMockBacking({
      run: async () => {
        fetchSpy();
        return { value: Math.random() };
      },
      identify: () => undefined,
      boundaries: { fetch: fetchSpy },
    });
    expect(report.identifiers).toEqual([undefined, undefined, undefined]);
    expect(report.mockBacked).toBe(false);
  });

  it('restores Math.random after running, including when the function throws', async () => {
    const original = Math.random;
    await detectMockBacking({ run: mockTxHash });
    expect(Math.random).toBe(original);

    await expect(
      detectMockBacking({
        run: async () => {
          throw new Error('boom');
        },
      })
    ).rejects.toThrow('boom');
    expect(Math.random).toBe(original);
  });

  it('rejects identical seeds', async () => {
    await expect(detectMockBacking({ run: mockTxHash, seeds: [1, 1] })).rejects.toThrow(
      'the two seeds must differ'
    );
  });
});

describe('expectNotMockBacked / expectMockBackingStatus', () => {
  it('throws with every reason for a mock-backed function', async () => {
    const report = await detectMockBacking({
      run: mockTxHash,
      boundaries: { signTx: vi.fn() },
    });
    expect(() => expectNotMockBacked('castVote', report)).toThrow(
      /castVote appears to be mock-backed:[\s\S]*Math\.random\(\) seed[\s\S]*"signTx" was never called/
    );
    expect(() => expectMockBackingStatus('castVote', report, 'real')).toThrow(/mock-backed/);
    expect(() => expectMockBackingStatus('castVote', report, 'mock')).not.toThrow();
  });

  it("asks for the status to be flipped once a 'mock' function becomes real", async () => {
    const signTx = vi.fn(async () => 'signed');
    const report = await detectMockBacking({ run: makeRealWrite(signTx), boundaries: { signTx } });
    expect(() => expectNotMockBacked('castVote', report)).not.toThrow();
    expect(() => expectMockBackingStatus('castVote', report, 'real')).not.toThrow();
    expect(() => expectMockBackingStatus('castVote', report, 'mock')).toThrow(
      /castVote no longer appears to be mock-backed.*from 'mock' to 'real'/
    );
  });
});
