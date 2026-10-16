import { NEXT_PUBLIC_ORACLE_ENABLED } from '@/constants';

interface OracleBadgeProps {
  verified: boolean;
}

export default function OracleBadge({ verified }: OracleBadgeProps) {
  const isEnabled = NEXT_PUBLIC_ORACLE_ENABLED || process.env.NEXT_PUBLIC_ORACLE_ENABLED === 'true';
  if (!isEnabled) return null;

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
