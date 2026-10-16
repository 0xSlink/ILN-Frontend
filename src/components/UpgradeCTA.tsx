'use client';

import Link from 'next/link';
import { useSubscription } from '@/context/SubscriptionContext';

const PRO_FEATURES = [
  { icon: 'analytics', label: 'Advanced analytics dashboard' },
  { icon: 'speed', label: 'Priority transaction processing' },
  { icon: 'support_agent', label: 'Dedicated support channel' },
  { icon: 'percent', label: 'Lower platform fees' },
];

export default function UpgradeCTA() {
  const { isPro, isBannerDismissed, dismissBanner } = useSubscription();

  if (isPro || isBannerDismissed) return null;

  return (
    <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-primary-container/30 p-6 relative">
      <button
        onClick={dismissBanner}
        aria-label="Dismiss upgrade banner"
        className="absolute top-4 right-4 p-1 rounded-full hover:bg-surface-variant/30 transition-colors"
      >
        <span className="material-symbols-outlined text-lg text-on-surface-variant">close</span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
            Upgrade to Pro
          </p>
          <h3 className="text-lg font-bold text-on-surface">
            Unlock the full ILN experience
          </h3>
          <ul className="mt-3 space-y-2">
            {PRO_FEATURES.map((feature) => (
              <li key={feature.icon} className="flex items-center gap-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-base text-primary">
                  {feature.icon}
                </span>
                {feature.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="sm:ml-4">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:bg-primary/90 transition-colors"
          >
            Upgrade
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
