/**
 * Payer reputation and risk-level classification utilities.
 *
 * ## Methodology, Data Sources & Assumptions
 *
 * ### 1. Inputs & Data Source
 * - Payer scores are fetched on-demand from the Soroban contract read method
 *   `payer_score(Address)` via `getPayerScore` / `getPayerScoresBatch` in
 *   `src/utils/soroban.ts`.
 * - When the contract returns a structured record, `settled_on_time` and `defaults`
 *   default to `0` if omitted; if the simulation fails, throws, or returns
 *   `null`/`undefined`, `getPayerScore` returns `null`.
 *
 * ### 2. Classification Boundaries (`scoreToRiskLevel`)
 * - `score >= 70` -> `'Low'`
 * - `40 <= score < 70` -> `'Medium'`
 * - `score < 40` -> `'High'`
 * - `null`, `undefined`, or non-finite (`NaN`, `±Infinity`) -> `'Unknown'`
 *
 * ### 3. Cache Staleness
 * - `usePayerScore` and `usePayerScores` (`src/hooks/queries/`) cache results using
 *   `QUERY_TIMINGS.payerScore` and `QUERY_TIMINGS.payerScores` (`staleTime: 30_000` ms,
 *   `gcTime: 300_000` ms in `src/hooks/queries/keys.ts`).
 * - Within that 30-second window, UI badges and filters may reflect cached scores
 *   until the next background refetch or cache invalidation.
 *
 * ### 4. Defaults & Unknown-Payer Behavior (Downstream Consumers)
 * - **Sorting (`RISK_SORT_ORDER`)**: `Low (0) < Medium (1) < High (2) < Unknown (3)`,
 *   placing unknown payers last in risk-sorted views.
 * - **Invoice risk scoring (`src/utils/riskCalculations.ts`)**: `calculateInvoiceRiskScore`
 *   defaults to a neutral `50` when `payerScore` is `null`, then subtracts up to `10`
 *   points for funding age (`min(fundingAge / 9, 10)`) and `5` points per recorded
 *   default, clamped to `[0, 100]`.
 * - **Marketplace threshold (`src/components/InvoiceMarketplaceCard.tsx`)**: Displays
 *   `Reputation: Unknown` when `payerScore` is `null`. The `minReputation` gate only
 *   triggers when `payerScore` is non-null (`payerScore && payerScore.score < minReputation`),
 *   so unknown payers are not automatically blocked by `minReputation` (residual risk).
 */

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Unknown';

export interface PayerScore {
  score: number;
  settled_on_time: number;
  defaults: number;
}

/**
 * Maps a numeric payer reputation score to a categorical {@link RiskLevel}.
 *
 * Returns `'Unknown'` for `null`, `undefined`, or non-finite values (`NaN`, `±Infinity`).
 */
export function scoreToRiskLevel(score: number | null | undefined): RiskLevel {
  if (score === null || score === undefined || !Number.isFinite(score)) return 'Unknown';
  if (score >= 70) return 'Low';
  if (score >= 40) return 'Medium';
  return 'High';
}

export const RISK_SORT_ORDER: Record<RiskLevel, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Unknown: 3,
};
