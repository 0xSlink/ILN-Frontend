'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import type { WalletRole } from '@/utils/soroban';
import ReferralWidget from './ReferralWidget';
import UpgradeCTA from './UpgradeCTA';

const roleCards: Array<{
  role: WalletRole;
  title: string;
  description: string;
  href: string;
  icon: string;
}> = [
  {
    role: 'freelancer',
    title: 'Freelancer',
    description: 'Review submitted invoices, statuses, and cancellation actions.',
    href: '/dashboard',
    icon: 'receipt_long',
  },
  {
    role: 'payer',
    title: 'Payer',
    description: 'See invoices assigned to your wallet and settlement actions.',
    href: '/payer',
    icon: 'payments',
  },
  {
    role: 'lp',
    title: 'Liquidity Provider',
    description: 'Track funded invoices, yield, and portfolio activity.',
    href: '/lp',
    icon: 'account_balance',
  },
];

interface Recommendation {
  id: string;
  type: 'fund' | 'reputation' | 'yield';
  title: string;
  description: string;
  icon: string;
  action: string;
  actionHref?: string;
}

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'fund-1',
    type: 'fund',
    title: 'Fund These Invoices',
    description:
      'You have 3 invoices in your watchlist with competitive rates. Consider funding to diversify your portfolio.',
    icon: 'trending_up',
    action: 'View Opportunities',
    actionHref: '/lp/marketplace',
  },
  {
    id: 'reputation-1',
    type: 'reputation',
    title: 'Improve Reputation',
    description:
      'Complete 2 more successful transactions to reach tier 2. This unlocks better rates and higher limits.',
    icon: 'verified_user',
    action: 'View Progress',
    actionHref: '/settings/reputation',
  },
  {
    id: 'yield-1',
    type: 'yield',
    title: 'Optimize Yield',
    description:
      'Your current allocation is heavily weighted to short-term invoices. Consider diversifying to longer-term positions.',
    icon: 'show_chart',
    action: 'Rebalance',
    actionHref: '/lp/portfolio',
  },
];

export default function PersonalizedDashboard() {
  const { isConnected, roles, rolesLoading } = useWallet();
  const [dismissedRecommendations, setDismissedRecommendations] = useState<Set<string>>(new Set());

  if (!isConnected) return null;

  const visibleRecommendations = RECOMMENDATIONS.filter(
    (rec) => !dismissedRecommendations.has(rec.id)
  );

  const handleDismissRecommendation = (id: string) => {
    setDismissedRecommendations((prev) => new Set([...prev, id]));
  };

  return (
    <section className="bg-surface-container-lowest px-8 py-12 border-b border-outline-variant/10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Personal dashboard
            </p>
            <h2 className="mt-2 text-2xl font-headline">Continue as your on-chain role</h2>
          </div>
          {rolesLoading ? (
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Detecting wallet roles...
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {roleCards.map((card) => {
            const active = roles.includes(card.role);
            return (
              <Link
                key={card.role}
                href={card.href}
                className={`rounded-lg border p-5 transition-colors ${
                  active
                    ? 'border-primary/40 bg-primary-container/45 shadow-sm'
                    : 'border-outline-variant/15 bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`material-symbols-outlined text-3xl ${
                      active ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                    style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {card.icon}
                  </span>
                  {active ? (
                    <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-primary">
                      Active
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-4 text-lg font-bold">{card.title}</h3>
                <p className="mt-2 text-sm text-on-surface-variant">{card.description}</p>
              </Link>
            );
          })}
        </div>

        {visibleRecommendations.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">
              Recommended for you
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              {visibleRecommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="material-symbols-outlined text-2xl text-primary">
                      {rec.icon}
                    </span>
                    <button
                      onClick={() => handleDismissRecommendation(rec.id)}
                      aria-label="Dismiss recommendation"
                      className="p-1 rounded hover:bg-surface-variant/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg text-on-surface-variant">
                        close
                      </span>
                    </button>
                  </div>
                  <h4 className="text-sm font-bold mb-1">{rec.title}</h4>
                  <p className="text-xs text-on-surface-variant mb-4 flex-grow">
                    {rec.description}
                  </p>
                  <Link
                    href={rec.actionHref || '#'}
                    className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                  >
                    {rec.action} →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8">
          <UpgradeCTA />
        </div>

        <ReferralWidget />
      </div>
    </section>
  );
}
