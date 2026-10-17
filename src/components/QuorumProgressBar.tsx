'use client';

import { useEffect, useState } from 'react';
import useReducedMotion from '@/hooks/useReducedMotion';

interface QuorumProgressBarProps {
  votesCast: number;
  quorumRequired: number;
  className?: string;
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function QuorumProgressBar({
  votesCast,
  quorumRequired,
  className = '',
}: QuorumProgressBarProps) {
  const [mounted, setMounted] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Skip the mount animation when reduced motion is preferred and reveal
    // the bar in its final state immediately.
    if (reducedMotion) {
      setMounted(true);
      return;
    }

    setMounted(false);
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, [votesCast, quorumRequired, reducedMotion]);

  const quorumMet = votesCast >= quorumRequired;
  const clampedVotes = Math.max(0, Math.min(votesCast, quorumRequired));
  const pct = quorumRequired > 0 ? Math.min((clampedVotes / quorumRequired) * 100, 100) : 0;
  const fillWidth = mounted ? pct : 0;
  const remainingVotes = Math.max(quorumRequired - votesCast, 0);
  const statusLabel = quorumMet ? 'Quorum met' : 'Quorum pending';
  const screenReaderText = `${pct.toFixed(0)}% complete. ${statusLabel}. ${
    quorumMet
      ? 'Required quorum reached.'
      : `${formatVotes(remainingVotes)} remaining to reach quorum.`
  }`;

  return (
    <div className={`space-y-2 ${className}`} data-testid="quorum-progress-bar">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-on-surface">
          Quorum: {formatVotes(votesCast)} / {formatVotes(quorumRequired)} required (
          {pct.toFixed(0)}%)
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 font-medium ${
            quorumMet
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-700'
          }`}
        >
          {quorumMet ? '✓ Quorum met' : '• Quorum pending'}
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full border border-outline-variant/20 bg-surface-container-high"
        role="progressbar"
        aria-valuenow={clampedVotes}
        aria-valuemin={0}
        aria-valuemax={quorumRequired}
        aria-label="Quorum progress"
        aria-valuetext={screenReaderText}
        aria-describedby="quorum-progress-status"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${fillWidth}%` }}
        />
      </div>
      <span id="quorum-progress-status" className="sr-only">
        {screenReaderText}
      </span>
    </div>
  );
}
