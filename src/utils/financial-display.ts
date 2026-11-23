import enTranslation from '../../public/locales/en/translation.json';
import esTranslation from '../../public/locales/es/translation.json';

export type FinancialDataSource = 'on-chain' | 'indexer' | 'reference-rate' | 'fallback';

export type RateFreshness = 'fresh' | 'stale' | 'unknown';

export type FinancialStatus =
  | 'pending'
  | 'funded'
  | 'paid'
  | 'defaulted'
  | 'disputed'
  | 'cancelled';

export type FinancialWarningKey = 'unavailable' | 'overflow' | 'staleRate' | 'fallbackData';

export type SupportedFinancialLocale = 'en' | 'es';

export interface FinancialProvenance {
  source: FinancialDataSource;
  label: string;
  labelKey?: FinancialCopyKey;
  updatedAt?: number;
  maxAgeSeconds?: number;
}

/**
 * Canonical source of truth for every financial status, warning, provenance,
 * freshness, and amount label translation key in ILN.
 *
 * Data sources & failure behavior:
 * - Translations are resolved from the shipped locale catalogs (`en`, `es`).
 * - BCP 47 language tags (e.g. `es-MX`, `en-US`) normalize to their base
 *   supported locale (`es` or `en`). Unsupported locales fall back to `en`.
 * - If an external translator returns an empty value or echoes a raw key path,
 *   lookup falls back to the verified catalog entry so untranslated keys are
 *   never exposed in financial UI.
 */
export const FINANCIAL_COPY_KEYS = {
  provenance: {
    'on-chain': 'financial.provenance.onChain',
    indexer: 'financial.provenance.indexer',
    'reference-rate': 'financial.provenance.referenceRate',
    fallback: 'financial.provenance.fallback',
  },
  freshness: {
    fresh: 'financial.freshness.fresh',
    stale: 'financial.freshness.stale',
    unknown: 'financial.freshness.unknown',
  },
  warnings: {
    unavailable: 'financial.warnings.unavailable',
    overflow: 'financial.warnings.overflow',
    staleRate: 'financial.warnings.staleRate',
    fallbackData: 'financial.warnings.fallbackData',
  },
  statuses: {
    pending: 'financial.statuses.pending',
    funded: 'financial.statuses.funded',
    paid: 'financial.statuses.paid',
    defaulted: 'financial.statuses.defaulted',
    disputed: 'financial.statuses.disputed',
    cancelled: 'financial.statuses.cancelled',
  },
  amounts: {
    totalVolume: 'financial.amounts.totalVolume',
    protocolFeesCollected: 'financial.amounts.protocolFeesCollected',
    usdEquivalentFunded: 'financial.amounts.usdEquivalentFunded',
    feesCollectedByProtocol: 'financial.amounts.feesCollectedByProtocol',
    zeroFeeBadge: 'financial.amounts.zeroFeeBadge',
    feeTooltip: 'financial.amounts.feeTooltip',
  },
} as const;

type LeafValues<T> = T extends string ? T : { [K in keyof T]: LeafValues<T[K]> }[keyof T];

export type FinancialCopyKey = LeafValues<typeof FINANCIAL_COPY_KEYS>;

const LOCALE_CATALOGS: Record<SupportedFinancialLocale, Record<string, unknown>> = {
  en: enTranslation as unknown as Record<string, unknown>,
  es: esTranslation as unknown as Record<string, unknown>,
};

export const SUPPORTED_FINANCIAL_LOCALES: readonly SupportedFinancialLocale[] = ['en', 'es'];

export const ALL_FINANCIAL_COPY_KEYS: readonly FinancialCopyKey[] = [
  ...Object.values(FINANCIAL_COPY_KEYS.provenance),
  ...Object.values(FINANCIAL_COPY_KEYS.freshness),
  ...Object.values(FINANCIAL_COPY_KEYS.warnings),
  ...Object.values(FINANCIAL_COPY_KEYS.statuses),
  ...Object.values(FINANCIAL_COPY_KEYS.amounts),
];

function lookupNestedString(catalog: Record<string, unknown>, key: string): string | undefined {
  let current: unknown = catalog;
  for (const segment of key.split('.')) {
    if (current === null || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' && current.trim().length > 0 ? current : undefined;
}

/**
 * Normalizes a BCP 47 locale tag to a supported ILN translation locale.
 */
export function normalizeFinancialLocale(locale?: string): SupportedFinancialLocale {
  if (!locale) return 'en';
  const base = locale.trim().toLowerCase().split(/[-_]/)[0];
  return base === 'es' ? 'es' : 'en';
}

/**
 * Resolves a localized financial copy string from the verified locale catalogs.
 * Optionally accepts an i18next-style translator while guarding against missing
 * translations or raw key echo.
 */
export function getFinancialCopy(
  key: FinancialCopyKey,
  locale?: string,
  translate?: (copyKey: string) => string
): string {
  if (translate) {
    const candidate = translate(key);
    if (typeof candidate === 'string' && candidate.trim().length > 0 && candidate !== key) {
      return candidate;
    }
  }

  const normalizedLocale = normalizeFinancialLocale(locale);
  const localized = lookupNestedString(LOCALE_CATALOGS[normalizedLocale], key);
  if (localized !== undefined) {
    return localized;
  }

  const fallback = lookupNestedString(LOCALE_CATALOGS.en, key);
  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Missing financial localization key: ${key}`);
}

export function getFinancialProvenanceLabel(
  source: FinancialDataSource,
  locale?: string,
  translate?: (copyKey: string) => string
): string {
  return getFinancialCopy(FINANCIAL_COPY_KEYS.provenance[source], locale, translate);
}

export function getRateFreshnessLabel(
  freshness: RateFreshness,
  locale?: string,
  translate?: (copyKey: string) => string
): string {
  return getFinancialCopy(FINANCIAL_COPY_KEYS.freshness[freshness], locale, translate);
}

export function getFinancialStatusLabel(
  status: FinancialStatus,
  locale?: string,
  translate?: (copyKey: string) => string
): string {
  return getFinancialCopy(FINANCIAL_COPY_KEYS.statuses[status], locale, translate);
}

export function getFinancialWarningLabel(
  warning: FinancialWarningKey,
  locale?: string,
  translate?: (copyKey: string) => string
): string {
  return getFinancialCopy(FINANCIAL_COPY_KEYS.warnings[warning], locale, translate);
}

export interface FinancialCopyAuditResult {
  complete: boolean;
  missingByLocale: Record<SupportedFinancialLocale, string[]>;
  untranslatedByLocale: Record<SupportedFinancialLocale, string[]>;
}

/**
 * Audits every financial copy key across all shipped locales to ensure:
 * 1. No key is missing or empty in any locale.
 * 2. No locale echoes a raw dot-separated key path.
 * 3. Non-reference locales do not expose untranslated English fallback text.
 */
export function auditFinancialCopyCompleteness(
  catalogs: Record<SupportedFinancialLocale, Record<string, unknown>> = LOCALE_CATALOGS
): FinancialCopyAuditResult {
  const missingByLocale: Record<SupportedFinancialLocale, string[]> = {
    en: [],
    es: [],
  };
  const untranslatedByLocale: Record<SupportedFinancialLocale, string[]> = {
    en: [],
    es: [],
  };

  for (const key of ALL_FINANCIAL_COPY_KEYS) {
    const enValue = lookupNestedString(catalogs.en, key);
    if (!enValue || enValue === key) {
      missingByLocale.en.push(key);
    }

    for (const locale of SUPPORTED_FINANCIAL_LOCALES) {
      if (locale === 'en') continue;
      const value = lookupNestedString(catalogs[locale], key);
      if (!value || value === key) {
        missingByLocale[locale].push(key);
      } else if (enValue && value === enValue) {
        untranslatedByLocale[locale].push(key);
      }
    }
  }

  const complete = SUPPORTED_FINANCIAL_LOCALES.every(
    (locale) => missingByLocale[locale].length === 0 && untranslatedByLocale[locale].length === 0
  );

  return {
    complete,
    missingByLocale,
    untranslatedByLocale,
  };
}

export function createFinancialProvenance(
  source: FinancialDataSource,
  updatedAt?: number,
  maxAgeSeconds?: number,
  locale?: string
): FinancialProvenance {
  const labelKey = FINANCIAL_COPY_KEYS.provenance[source];
  return {
    source,
    label: getFinancialCopy(labelKey, locale),
    labelKey,
    updatedAt,
    maxAgeSeconds,
  };
}

export function getRateFreshness(
  updatedAt: number | undefined,
  now = Date.now(),
  maxAgeSeconds = 300
): RateFreshness {
  if (!Number.isFinite(updatedAt) || updatedAt === undefined) return 'unknown';
  if (updatedAt > now) return 'stale';
  return now - updatedAt <= maxAgeSeconds * 1000 ? 'fresh' : 'stale';
}

/**
 * Options controlling financial USD formatting.
 */
export interface FormatFinancialUsdOptions {
  /**
   * BCP 47 locale code (e.g. 'en-US', 'de-DE', 'fr-FR', 'es-ES'). Defaults to 'en-US'.
   */
  locale?: string;
  /**
   * When true or when compact is false, displays exact un-abbreviated balance.
   */
  exact?: boolean;
  /**
   * Whether to abbreviate large amounts with K, M, B, T suffixes.
   * Defaults to true unless exact=true.
   */
  compact?: boolean;
  /**
   * Minimum fraction digits to display.
   */
  minimumFractionDigits?: number;
  /**
   * Maximum fraction digits to display.
   */
  maximumFractionDigits?: number;
  /**
   * Shorthand setting both minimum and maximum fraction digits to a fixed precision.
   */
  decimals?: number;
}

/**
 * Formats a monetary USD value for protocol display with support for:
 * - Negative values with correct accounting minus sign placement (`-$12.50` instead of `$-12.50`).
 * - Compact abbreviations (`K`, `M`, `B`, `T`) with negative handling (`-$12.5K`).
 * - Exact balance display (`options.exact = true` or `formatExactFinancialUsd`).
 * - Custom precision and decimal control (`options.decimals`, `maximumFractionDigits`, etc.).
 * - Locale-aware formatting (`options.locale`) and localized warning labels.
 * - IEEE-754 overflow prevention: numbers exceeding Number.MAX_SAFE_INTEGER return the localized overflow label.
 * - Non-finite, null, or undefined values return the localized unavailable label.
 *
 * @param value Number or bigint amount in USD.
 * @param options Display and formatting preferences.
 * @returns Formatted USD currency string.
 */
export function formatFinancialUsd(
  value: number | bigint | null | undefined,
  options?: FormatFinancialUsdOptions
): string {
  const locale = options?.locale ?? 'en-US';

  if (value === null || value === undefined) {
    return getFinancialWarningLabel('unavailable', locale);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return getFinancialWarningLabel('unavailable', locale);
    if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      return getFinancialWarningLabel('overflow', locale);
    }
  }

  const isExact = options?.exact === true || options?.compact === false;

  // Determine negative state and treat negative zero as positive zero
  const isNegative = typeof value === 'bigint' ? value < 0n : value < 0 && !Object.is(value, -0);

  const sign = isNegative ? '-' : '';

  const minDigits = options?.decimals ?? options?.minimumFractionDigits;
  const rawMaxDigits = options?.decimals ?? options?.maximumFractionDigits;
  const maxDigits =
    rawMaxDigits !== undefined
      ? Math.max(rawMaxDigits, minDigits ?? 0)
      : minDigits !== undefined
        ? Math.max(minDigits, 2)
        : undefined;

  // Exact balance display mode: full precision without compact suffix
  if (isExact) {
    if (typeof value === 'bigint') {
      const absBig = value < 0n ? -value : value;
      const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: minDigits,
        maximumFractionDigits: maxDigits,
      }).format(absBig);
      return `${sign}$${formatted}`;
    }

    const absNum = Math.abs(value);
    const effectiveMaxDigits = maxDigits ?? (Number.isInteger(absNum) ? (minDigits ?? 0) : 2);
    const formatted = absNum.toLocaleString(locale, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: Math.max(effectiveMaxDigits, minDigits ?? 0),
    });
    return `${sign}$${formatted}`;
  }

  // Compact display mode (default)
  const absNum = typeof value === 'bigint' ? Number(value < 0n ? -value : value) : Math.abs(value);

  if (absNum >= 1_000_000_000_000) {
    const formatted = (absNum / 1_000_000_000_000).toLocaleString(locale, {
      minimumFractionDigits: minDigits ?? 2,
      maximumFractionDigits: maxDigits ?? 2,
    });
    return `${sign}$${formatted}T`;
  }

  if (absNum >= 1_000_000_000) {
    const formatted = (absNum / 1_000_000_000).toLocaleString(locale, {
      minimumFractionDigits: minDigits ?? 2,
      maximumFractionDigits: maxDigits ?? 2,
    });
    return `${sign}$${formatted}B`;
  }

  if (absNum >= 1_000_000) {
    const formatted = (absNum / 1_000_000).toLocaleString(locale, {
      minimumFractionDigits: minDigits ?? 2,
      maximumFractionDigits: maxDigits ?? 2,
    });
    return `${sign}$${formatted}M`;
  }

  if (absNum >= 1_000) {
    const formatted = (absNum / 1_000).toLocaleString(locale, {
      minimumFractionDigits: minDigits ?? 1,
      maximumFractionDigits: maxDigits ?? 1,
    });
    return `${sign}$${formatted}K`;
  }

  const effectiveMaxDigits = maxDigits ?? 2;
  const formatted = absNum.toLocaleString(locale, {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: Math.max(effectiveMaxDigits, minDigits ?? 0),
  });
  return `${sign}$${formatted}`;
}

/**
 * Shorthand for exact-balance display without K/M/B/T abbreviation.
 */
export function formatExactFinancialUsd(
  value: number | bigint | null | undefined,
  options?: Omit<FormatFinancialUsdOptions, 'exact' | 'compact'>
): string {
  return formatFinancialUsd(value, { ...options, exact: true });
}
