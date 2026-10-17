import { useEffect } from 'react';
import { NEXT_PUBLIC_ORACLE_ENABLED } from '@/constants';
import { trackEvent } from '@/lib/analytics';

/**
 * Health of the oracle registry feed used for payer verification,
 * derived from the contract's oracle state (see `oracle_registry.rs`).
 */
export type OracleRegistryState = 'healthy' | 'circuit_tripped' | 'data_stale' | 'unconfigured';

interface OracleBadgeProps {
  verified: boolean;
  /**
   * Best-effort oracle registry health. When tripped or stale the badge
   * reflects the degraded oracle state instead of the payer's last
   * verification result.
   */
  registryState?: OracleRegistryState | null;
}

export default function OracleBadge({ verified, registryState = 'healthy' }: OracleBadgeProps) {
  const isEnabled = NEXT_PUBLIC_ORACLE_ENABLED || process.env.NEXT_PUBLIC_ORACLE_ENABLED === 'true';

  useEffect(() => {
    if (isEnabled) {
      trackEvent('oracle_badge_seen', { verified });
    }
  }, [isEnabled, verified]);

  if (!isEnabled) return null;

  if (registryState === 'circuit_tripped') {
    return (
      <span
        title="The oracle circuit breaker is open after repeated stale data, so payer verification is temporarily unavailable."
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path
            d="M5 1.5L9 8H1L5 1.5z"
            fill="#d97706"
            stroke="#fff"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          <path d="M5 4.2v1.8M5 6.9v.2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        Verification Unavailable
      </span>
    );
  }

  if (registryState === 'data_stale') {
    return (
      <span
        title="The latest oracle response is older than the configured freshness window."
        className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path
            d="M5 1.5L9 8H1L5 1.5z"
            fill="#ea580c"
            stroke="#fff"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          <path d="M5 4.2v1.8M5 6.9v.2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        Oracle Data Stale
      </span>
    );
  }

  if (registryState === 'unconfigured') {
    return (
      <span
        title="No oracle feed is configured for payer verification; funding will fail open."
        className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-2 py-0.5 text-xs font-semibold text-on-surface-variant"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <circle cx="5" cy="5" r="5" fill="#9ca3af" />
          <path d="M5 3v2.5M5 6.8v.2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        Oracle Not Configured
      </span>
    );
  }

  if (verified) {
    return (
      <span
        title="This address has been verified by the ILN off-chain oracle"
        className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <circle cx="5" cy="5" r="5" fill="#16a34a" />
          <path
            d="M2.5 5l1.8 1.8L7.5 3.5"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Oracle Verified
      </span>
    );
  }

  return (
    <span
      title="This address has not been verified by the ILN off-chain oracle"
      className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-2 py-0.5 text-xs font-semibold text-on-surface-variant"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <circle cx="5" cy="5" r="5" fill="#9ca3af" />
        <path d="M5 3v2.5M5 6.8v.2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      Unverified
    </span>
  );
}
