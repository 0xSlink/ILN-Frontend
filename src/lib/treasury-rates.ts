const TREASURY_3M_TBILL_URL =
  'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/avg_interest_rates' +
  '?filter=security_type_desc:eq:Treasury Bill,security_desc:eq:3-Month' +
  '&sort=-record_date&page[size]=1';

/** Human-readable origin of the benchmark rate, surfaced next to the value in the UI. */
export const THREE_MONTH_TBILL_SOURCE = 'U.S. Treasury Fiscal Data (3-month T-bill)';

interface TreasuryRateRecord {
  avg_interest_rate_amt?: string;
}

interface TreasuryRateResponse {
  data?: TreasuryRateRecord[];
}

/**
 * Fetch the latest valid 3-month T-bill average rate (annual %).
 *
 * Returns `null` when the authoritative source cannot be read rather than a
 * fabricated "illustrative" default, so callers can block the derived yield
 * comparison instead of rendering an unverified financial value. Callers are
 * expected to surface {@link THREE_MONTH_TBILL_SOURCE} and their own freshness
 * timestamp alongside any value they display.
 */
export async function fetchThreeMonthTBillRatePct(): Promise<number | null> {
  try {
    const response = await fetch(TREASURY_3M_TBILL_URL, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 86_400 },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as TreasuryRateResponse;
    const rate = parseFloat(payload.data?.[0]?.avg_interest_rate_amt ?? '');
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}
