import React, { useEffect, useState } from 'react';

interface VotingProgressBarProps {
  for: number;
  against: number;
  quorum: number;
  totalEligible: number;
}

export default function VotingProgressBar({
  for: forVotes,
  against,
  quorum,
  totalEligible,
}: VotingProgressBarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    setMounted(true);
  }, []);

  const totalVotesCast = forVotes + against;

  // Percentages relative to total votes cast for the bar segments
  const getPercentage = (count: number) => {
    if (totalVotesCast === 0) return 0;
    return (count / totalVotesCast) * 100;
  };

  const forPct = getPercentage(forVotes);
  const againstPct = getPercentage(against);

  // Quorum position relative to total eligible
  const quorumThresholdPct = (quorum / totalEligible) * 100;
  const quorumReached = totalVotesCast >= quorum;

  return (
    <div className="w-full flex flex-col gap-8 p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 shadow-sm">
      {/* ── Labels Above segments ────────────────────────────────────────── */}
      <div className="flex w-full justify-between items-end gap-2 px-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
            For
          </span>
          <span className="text-sm font-bold text-on-surface">
            {forVotes.toLocaleString()}{' '}
            <span className="text-on-surface-variant font-medium">({forPct.toFixed(1)}%)</span>
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold uppercase tracking-widest text-error mb-1">
            Against
          </span>
          <span className="text-sm font-bold text-on-surface">
            {against.toLocaleString()}{' '}
            <span className="text-on-surface-variant font-medium">({againstPct.toFixed(1)}%)</span>
          </span>
        </div>
      </div>

      {/* ── Progress Bar Container ────────────────────────────────────────── */}
      <div className="relative w-full h-4 bg-surface-container rounded-full overflow-visible flex">
        {/* For Segment */}
        <div
          className="h-full bg-primary transition-[width] duration-500 ease-out first:rounded-l-full last:rounded-r-full"
          style={{ width: mounted ? `${forPct}%` : '0%' }}
        />
        {/* Against Segment */}
        <div
          className="h-full bg-error transition-[width] duration-500 ease-out first:rounded-l-full last:rounded-r-full"
          style={{ width: mounted ? `${againstPct}%` : '0%' }}
        />

        {/* Quorum Tick Mark */}
        <div
          className="absolute h-8 w-0.5 bg-on-surface top-1/2 -translate-y-1/2 z-10 transition-[left] duration-500 ease-out"
          style={{ left: `${quorumThresholdPct}%` }}
        >
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap">
            <span className="text-[9px] font-bold uppercase tracking-tighter text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded">
              Quorum: {quorum.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom Info ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2 border-t border-outline-variant/10">
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              quorumReached
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-amber-500/10 text-amber-500'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {quorumReached ? 'check_circle' : 'error'}
            </span>
            {quorumReached ? 'Quorum Reached' : 'Quorum Not Reached'}
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Total Cast
            </span>
            <span className="text-sm font-bold text-on-surface">
              {totalVotesCast.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Eligible
            </span>
            <span className="text-sm font-bold text-on-surface">
              {totalEligible.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
