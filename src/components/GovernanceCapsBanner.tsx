'use client';

import React from 'react';
import Link from 'next/link';

export interface GovernanceCapsBannerProps {
  /** Maximum single-invoice amount formatted (e.g. "5,000 USDC") */
  maxInvoiceAmountFormatted?: string | null;
  /** Cumulative token TVL/volume cap formatted (e.g. "50,000 USDC") */
  tokenVolumeCapFormatted?: string | null;
  /** Current token volume formatted if available (e.g. "12,400 USDC") */
  currentVolumeFormatted?: string | null;
  /** Mode of presentation */
  variant?: 'inline' | 'banner';
  /** Optional custom class name */
  className?: string;
}

export default function GovernanceCapsBanner({
  maxInvoiceAmountFormatted,
  tokenVolumeCapFormatted,
  currentVolumeFormatted,
  variant = 'banner',
  className = '',
}: GovernanceCapsBannerProps) {
  const hasMaxInvoiceCap = Boolean(maxInvoiceAmountFormatted);
  const hasVolumeCap = Boolean(tokenVolumeCapFormatted);

  if (!hasMaxInvoiceCap && !hasVolumeCap) {
    return null;
  }

  if (variant === 'inline') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="governance-cap-notice"
        className={`flex items-center gap-2 rounded-xl bg-surface-container-high/60 px-3 py-2 text-xs text-on-surface-variant border border-outline-variant/15 ${className}`}
      >
        <span
          className="material-symbols-outlined text-[18px] text-primary shrink-0"
          aria-hidden="true"
        >
          verified_user
        </span>
        <div className="flex-1 min-w-0">
          <span>
            {hasMaxInvoiceCap
              ? `Maximum invoice amount during initial launch: ${maxInvoiceAmountFormatted}`
              : `Token volume cap during initial launch: ${tokenVolumeCapFormatted}`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Governance launch safeguards"
      data-testid="governance-caps-banner"
      className={`rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 shadow-sm text-on-surface transition-all ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              shield
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-on-surface">
                Staged Rollout Safeguards Active
              </h4>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                Governance Gated
              </span>
            </div>
            <p className="mt-1 text-xs text-on-surface-variant leading-relaxed">
              To ensure stability during mainnet launch, temporary TVL and per-invoice thresholds are
              enforced. These parameters can be expanded through governance proposals.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-4 text-xs font-medium">
              {hasMaxInvoiceCap && (
                <div
                  data-testid="banner-max-invoice-cap"
                  className="flex items-center gap-1.5 text-on-surface"
                >
                  <span className="text-on-surface-variant">Max Invoice Size:</span>
                  <span className="font-semibold text-primary">{maxInvoiceAmountFormatted}</span>
                </div>
              )}
              {hasVolumeCap && (
                <div
                  data-testid="banner-token-volume-cap"
                  className="flex items-center gap-1.5 text-on-surface"
                >
                  <span className="text-on-surface-variant">TVL / Volume Cap:</span>
                  <span className="font-semibold text-primary">
                    {currentVolumeFormatted ? `${currentVolumeFormatted} / ` : ''}
                    {tokenVolumeCapFormatted}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="self-end sm:self-center shrink-0">
          <Link
            href="/governance"
            className="inline-flex items-center gap-1 rounded-xl border border-primary/30 bg-surface-container-lowest px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span>View Governance</span>
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              arrow_forward
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
