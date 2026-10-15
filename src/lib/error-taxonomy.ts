/**
 * Production error telemetry taxonomy (#1157).
 *
 * Every failure is tagged with a domain (auth, governance, wallet, indexer,
 * accessibility) and a stable code, so dashboards and alerts group failures
 * the same way across the app. Reports flow through `reportError`, so they
 * keep the existing Sentry / `iln:error` / analytics routing.
 */

import { reportError } from './errorTracking';

export const ERROR_TAXONOMY = {
  auth: ['session_expired', 'unauthorized', 'signature_rejected', 'unknown'],
  governance: [
    'vote_failed',
    'proposal_not_found',
    'execution_failed',
    'veto_failed',
    'tx_timeout',
    'unknown',
  ],
  wallet: ['not_installed', 'connection_rejected', 'network_mismatch', 'sign_rejected', 'unknown'],
  indexer: ['unavailable', 'malformed_response', 'rate_limited', 'unknown'],
  accessibility: ['focus_trap_failed', 'missing_label', 'contrast_violation', 'unknown'],
} as const;

export type ErrorDomain = keyof typeof ERROR_TAXONOMY;
export type ErrorCode = (typeof ERROR_TAXONOMY)[ErrorDomain][number];

export const ERROR_DOMAINS = Object.keys(ERROR_TAXONOMY) as ErrorDomain[];

/** Codes where a user retry can reasonably succeed. Everything else is not retryable. */
const RETRYABLE_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'unavailable',
  'rate_limited',
  'tx_timeout',
  'connection_rejected',
]);

export function isErrorCode(domain: ErrorDomain, code: string): code is ErrorCode {
  return (ERROR_TAXONOMY[domain] as readonly string[]).includes(code);
}

export interface TaxonomizedError {
  domain: ErrorDomain;
  code: ErrorCode;
  retryable: boolean;
}

/** Error carrying its taxonomy classification. Throw this at the failure site. */
export class TaxonomyError extends Error {
  readonly domain: ErrorDomain;
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(domain: ErrorDomain, code: ErrorCode, message?: string) {
    super(message ?? `${domain}:${code}`);
    this.name = 'TaxonomyError';
    this.domain = domain;
    this.code = code;
    this.retryable = RETRYABLE_CODES.has(code);
  }
}

/**
 * Classifies any thrown value within a known domain. Unclassified values fall
 * back to the domain's `unknown` code so every report stays groupable.
 */
export function classifyError(domain: ErrorDomain, error: unknown): TaxonomizedError {
  if (error instanceof TaxonomyError) {
    return { domain: error.domain, code: error.code, retryable: error.retryable };
  }
  return { domain, code: 'unknown', retryable: false };
}

/** Reports a failure with its taxonomy tags. Never throws. */
export function reportTaxonomizedError(
  domain: ErrorDomain,
  error: unknown,
  extra?: Record<string, unknown>
): TaxonomizedError {
  const classified = classifyError(domain, error);
  try {
    const cause = error instanceof Error ? error : new Error(String(error));
    reportError(cause, {
      ...extra,
      errorDomain: classified.domain,
      errorCode: classified.code,
      retryable: classified.retryable,
    });
  } catch {
    // Error reporting must never break the caller.
  }
  return classified;
}
