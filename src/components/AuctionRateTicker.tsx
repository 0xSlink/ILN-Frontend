'use client';

import { useState, useEffect, useRef } from 'react';
import useReducedMotion from '@/hooks/useReducedMotion';

export interface AuctionRateProps {
  startRate: number;
  minRate: number;
  auctionStartTime: number;
  auctionDurationSeconds: number;
}

/**
 * Returns the current auction rate in bps based on elapsed time.
 * Rate decreases linearly from startRate to minRate over the auction duration.
 */
export function calculateCurrentRate(
  startRate: number,
  minRate: number,
  auctionStartTime: number,
  auctionDurationSeconds: number,
  nowMs: number = Date.now()
): number {
  const elapsed = nowMs / 1000 - auctionStartTime;
  if (elapsed <= 0) return startRate;
  if (elapsed >= auctionDurationSeconds) return minRate;
  const progress = elapsed / auctionDurationSeconds;
  return Math.round(startRate - (startRate - minRate) * progress);
}

export default function AuctionRateTicker({
  startRate,
  minRate,
  auctionStartTime,
  auctionDurationSeconds,
}: AuctionRateProps) {
  const [currentRate, setCurrentRate] = useState(() =>
    calculateCurrentRate(startRate, minRate, auctionStartTime, auctionDurationSeconds)
  );
  const [secondsLeft, setSecondsLeft] = useState(0);
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    function tick() {
      const now = Date.now();
      setCurrentRate(
        calculateCurrentRate(startRate, minRate, auctionStartTime, auctionDurationSeconds, now)
      );
      const endTime = (auctionStartTime + auctionDurationSeconds) * 1000;
      setSecondsLeft(Math.max(0, Math.round((endTime - now) / 1000)));
    }

    // When reduced motion is preferred, render a single static snapshot
    // instead of starting a live, ticking countdown. The CSS transition on
    // the progress bar is neutralised globally under prefers-reduced-motion.
    if (reducedMotion) {
      tick();
      return;
    }

    tick();
    rafRef.current = setInterval(tick, 1000);
    return () => {
      if (rafRef.current) clearInterval(rafRef.current);
    };
  }, [startRate, minRate, auctionStartTime, auctionDurationSeconds, reducedMotion]);

  const progress = startRate === minRate ? 1 : (startRate - currentRate) / (startRate - minRate);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isExpired = secondsLeft === 0;

  return (
    <div
      className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2"
      data-testid="auction-rate-ticker"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-amber-800 font-semibold">Current Rate</span>
        <span className="text-amber-900 font-bold tabular-nums" data-testid="current-rate">
          {currentRate} bps
          <span className="text-xs font-normal text-amber-600 ml-1">
            (decreasing to {minRate} bps)
          </span>
        </span>
      </div>

      <div
        className="w-full bg-amber-200 rounded-full h-1.5"
        role="progressbar"
        aria-valuenow={currentRate}
        aria-valuemin={minRate}
        aria-valuemax={startRate}
        aria-label="Auction rate progress"
      >
        <div
          className="bg-amber-500 h-1.5 rounded-full transition-all duration-1000"
          style={{ width: `${(1 - progress) * 100}%` }}
        />
      </div>

      {!isExpired ? (
        <p className="text-xs text-amber-700 font-medium" data-testid="urgency-label">
          Act now — rate decreases in{' '}
          <span className="font-bold tabular-nums">
            {minutes}m {seconds.toString().padStart(2, '0')}s
          </span>
        </p>
      ) : (
        <p className="text-xs text-amber-700 font-medium" data-testid="urgency-label">
          Auction at minimum rate ({minRate} bps)
        </p>
      )}
    </div>
  );
}
