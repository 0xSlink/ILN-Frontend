import { describe, expect, it } from 'vitest';
import {
  FIRST_USABLE_RENDER_BUDGET_MS,
  INTERACTION_BUDGET_SURFACES,
  evaluateInteractionBudget,
  startFirstUsableRenderTimer,
} from '../interaction-budget';

describe('evaluateInteractionBudget', () => {
  it('passes when the measured render is at or under budget', () => {
    const budget = FIRST_USABLE_RENDER_BUDGET_MS['activity-feed'];
    const result = evaluateInteractionBudget('activity-feed', budget);
    expect(result).toEqual({
      surface: 'activity-feed',
      durationMs: budget,
      budgetMs: budget,
      withinBudget: true,
      overByMs: 0,
    });
  });

  it('fails and reports the overage when the render exceeds budget', () => {
    const budget = FIRST_USABLE_RENDER_BUDGET_MS['funding-chart'];
    const result = evaluateInteractionBudget('funding-chart', budget + 250);
    expect(result.withinBudget).toBe(false);
    expect(result.overByMs).toBe(250);
  });

  it('defines a positive budget for every instrumented surface', () => {
    for (const surface of INTERACTION_BUDGET_SURFACES) {
      expect(FIRST_USABLE_RENDER_BUDGET_MS[surface]).toBeGreaterThan(0);
    }
  });

  it('keeps representative indexer latency inside each budget', () => {
    // Representative p95 indexer response (800ms) plus one client render pass.
    const representativeLatencyMs = 800;
    const renderPassMs = 300;
    for (const surface of INTERACTION_BUDGET_SURFACES) {
      const result = evaluateInteractionBudget(surface, representativeLatencyMs + renderPassMs);
      expect(result.withinBudget).toBe(true);
    }
  });
});

describe('startFirstUsableRenderTimer', () => {
  it('returns elapsed time between mount and the first markUsable call', () => {
    const ticks = [100, 1350, 9999];
    let i = 0;
    const timer = startFirstUsableRenderTimer(() => ticks[i++]);
    expect(timer.markUsable()).toBe(1250);
  });

  it('ignores later markUsable calls so the first usable render is what counts', () => {
    const ticks = [0, 500, 900];
    let i = 0;
    const timer = startFirstUsableRenderTimer(() => ticks[i++]);
    expect(timer.markUsable()).toBe(500);
    expect(timer.markUsable()).toBe(500);
  });
});
