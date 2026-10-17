/**
 * Interaction budgets for indexer-backed dashboards (#1153).
 *
 * A budget is the maximum time a surface may take from mount to its first
 * usable render under representative indexer latency. Budgets are evaluated
 * against measured durations so a regression fails a test instead of
 * shipping silently.
 */

export const INTERACTION_BUDGET_SURFACES = [
  'activity-feed',
  'default-rate-chart',
  'funding-chart',
] as const;

export type InteractionBudgetSurface = (typeof INTERACTION_BUDGET_SURFACES)[number];

/** Mount-to-first-usable-render budget per surface, in milliseconds. */
export const FIRST_USABLE_RENDER_BUDGET_MS: Record<InteractionBudgetSurface, number> = {
  'activity-feed': 1500,
  'default-rate-chart': 2000,
  'funding-chart': 2000,
};

export interface InteractionBudgetResult {
  surface: InteractionBudgetSurface;
  durationMs: number;
  budgetMs: number;
  withinBudget: boolean;
  overByMs: number;
}

export function evaluateInteractionBudget(
  surface: InteractionBudgetSurface,
  durationMs: number
): InteractionBudgetResult {
  const budgetMs = FIRST_USABLE_RENDER_BUDGET_MS[surface];
  const withinBudget = durationMs <= budgetMs;
  return {
    surface,
    durationMs,
    budgetMs,
    withinBudget,
    overByMs: withinBudget ? 0 : durationMs - budgetMs,
  };
}

/**
 * Starts a timer at mount. Call `markUsable()` once the surface shows real
 * data (or its explicit empty/error state); it returns elapsed milliseconds.
 */
export function startFirstUsableRenderTimer(now: () => number = () => performance.now()) {
  const startedAt = now();
  let finishedAt: number | null = null;

  return {
    markUsable(): number {
      if (finishedAt === null) finishedAt = now();
      return finishedAt - startedAt;
    },
  };
}
