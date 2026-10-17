'use client';

import { useEffect, useRef, useState } from 'react';
import { votePercent } from '@/utils/governance';

interface VoteProgressBarProps {
  votesFor: number;
  votesAgainst: number;
  quorumRequired: number;
  compact?: boolean;
}

export default function VoteProgressBar({
  votesFor,
  votesAgainst,
  quorumRequired,
  compact = false,
}: VoteProgressBarProps) {
  const total = votesFor + votesAgainst;
  const forPct = votePercent(votesFor, total);
  const againstPct = votePercent(votesAgainst, total);
  const quorumPct = Math.min((total / quorumRequired) * 100, 100);
  const quorumReached = total >= quorumRequired;
  const forIsWinning = forPct > 50;

  // Suppress animation on initial render — only animate on vote updates
  const isFirstRender = useRef(true);
  const [transitionEnabled, setTransitionEnabled] = useState(false);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setTransitionEnabled(true);
  }, [votesFor, votesAgainst]);

  const t500 = transitionEnabled ? 'transition-all duration-500 ease-in-out' : '';
  const t700 = transitionEnabled ? 'transition-all duration-700 ease-in-out' : '';

  function fmt(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  // Color shifts when "For" crosses the 50% winning threshold
  const forBarColor = forIsWinning ? 'bg-emerald-600' : 'bg-emerald-500';
  const forTextColor = forIsWinning ? 'text-emerald-600' : 'text-emerald-500';
  const forDotColor = forIsWinning ? 'bg-emerald-600' : 'bg-emerald-500';

  if (compact) {
    return (
      <div className="space-y-1.5">
        {/* Stacked bar */}
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div className={`${forBarColor} ${t500}`} style={{ width: `${forPct}%` }} />
          <div className={`bg-red-500 ${t500}`} style={{ width: `${againstPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className={`inline-block w-2 h-2 rounded-full ${forDotColor}`} />
            {forPct}% For
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            {againstPct}% Against
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* For */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-sm font-semibold ${forTextColor}`}>Vote For</span>
          <span className="text-sm text-on-surface-variant">
            {fmt(votesFor)} ILN &middot; {forPct}%
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-surface-container-high overflow-hidden">
          <div
            className={`h-full rounded-full ${forBarColor} ${t700}`}
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>

      {/* Against */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-red-500">Vote Against</span>
          <span className="text-sm text-on-surface-variant">
            {fmt(votesAgainst)} ILN &middot; {againstPct}%
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-surface-container-high overflow-hidden">
          <div
            className={`h-full rounded-full bg-red-500 ${t700}`}
            style={{ width: `${againstPct}%` }}
          />
        </div>
      </div>

      {/* Quorum indicator */}
      <div className="pt-1 border-t border-outline-variant/20">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
            <span
              className={`material-symbols-outlined text-[14px] ${
                quorumReached ? 'text-emerald-500' : 'text-on-surface-variant'
              }`}
            >
              {quorumReached ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            Quorum {quorumReached ? 'reached' : 'not yet reached'}
          </span>
          <span className="text-xs text-on-surface-variant">
            {fmt(total)} / {fmt(quorumRequired)} ILN
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
          <div
            className={`h-full rounded-full ${t700} ${
              quorumReached ? 'bg-primary' : 'bg-primary/50'
            }`}
            style={{ width: `${quorumPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
