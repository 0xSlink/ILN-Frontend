'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useReputation } from '@/hooks/queries';
import Skeleton from '@/components/ui/Skeleton';

interface PayerReputationCardProps {
  address: string;
  refreshTrigger?: number;
}

export default function PayerReputationCard({ address, refreshTrigger }: PayerReputationCardProps) {
  const { data: reputation, isLoading, isError, error, refetch } = useReputation(address);
  const [showTooltip, setShowTooltip] = useState(false);
  const prevRefreshTrigger = React.useRef(refreshTrigger);

  useEffect(() => {
    if (
      refreshTrigger !== undefined &&
      prevRefreshTrigger.current !== undefined &&
      refreshTrigger !== prevRefreshTrigger.current
    ) {
      void refetch();
    }
    prevRefreshTrigger.current = refreshTrigger;
  }, [refreshTrigger, refetch]);

  useEffect(() => {
    if (isError && error) {
      console.error('Failed to load reputation:', error);
    }
  }, [isError, error]);

  if (isLoading && !reputation) {
    return (
      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
        <Skeleton className="h-6 w-32" />
        <div className="mt-6 flex items-center gap-8">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const score = reputation?.score ?? 0;
  const strokeDasharray = 2 * Math.PI * 36;
  const strokeDashoffset = strokeDasharray - (score / 100) * strokeDasharray;

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-on-surface">Reputation</h2>
          <div
            className="relative cursor-help group"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
          >
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
              info
            </span>
            {showTooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[200] w-48 rounded-lg bg-surface-container-high p-3 shadow-lg text-xs text-on-surface border border-outline-variant/20">
                Your score affects whether LPs are willing to fund your invoices
              </div>
            )}
          </div>
        </div>
        <Link
          href="/governance/how-it-works"
          className="text-sm font-bold text-primary hover:underline"
        >
          How reputation works
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-8">
        <div className="relative h-24 w-24 flex items-center justify-center shrink-0">
          <svg className="h-24 w-24 -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="36"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="8"
              className="text-outline-variant/10"
            />
            <circle
              cx="48"
              cy="48"
              r="36"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={`transition-all duration-1000 ${
                score > 80 ? 'text-emerald-500' : score > 50 ? 'text-amber-500' : 'text-red-500'
              }`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-on-surface leading-none">{score}</span>
            <span className="text-[10px] uppercase font-bold text-on-surface-variant mt-1">
              Score
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 flex-1 w-full">
          <div className="bg-surface-container/30 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant mb-1">
              Paid
            </p>
            <p className="text-xl font-bold text-on-surface">{reputation?.invoices_paid ?? 0}</p>
          </div>
          <div className="bg-surface-container/30 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant mb-1">
              Defaulted
            </p>
            <p className="text-xl font-bold text-red-600">{reputation?.invoices_defaulted ?? 0}</p>
          </div>
          <div className="bg-surface-container/30 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant mb-1">
              Submitted
            </p>
            <p className="text-xl font-bold text-on-surface">
              {reputation?.invoices_submitted ?? 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
