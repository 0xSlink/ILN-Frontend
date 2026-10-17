'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import useReducedMotion from '@/hooks/useReducedMotion';

interface ScoreSimulatorProps {
  currentPaid: number;
  currentSubmitted: number;
  currentDefaulted: number;
}

export const ScoreSimulator: React.FC<ScoreSimulatorProps> = ({
  currentPaid,
  currentSubmitted,
  currentDefaulted: _currentDefaulted,
}) => {
  const [additionalPaid, setAdditionalPaid] = useState<number>(0);
  const [additionalDefaulted, setAdditionalDefaulted] = useState<number>(0);
  const [displayScore, setDisplayScore] = useState<number | string>(0);
  const reducedMotion = useReducedMotion();

  const currentScore = useMemo(() => {
    if (currentSubmitted === 0) return 0;
    return Math.min(100, Math.max(0, (currentPaid / currentSubmitted) * 100));
  }, [currentPaid, currentSubmitted]);

  const projectedScore = useMemo(() => {
    const totalPaid = currentPaid + additionalPaid;
    const totalSubmitted = currentSubmitted + additionalPaid + additionalDefaulted;

    if (totalSubmitted === 0) return 'No impact calculable';

    const score = (totalPaid / totalSubmitted) * 100;
    return Math.min(100, Math.max(0, score));
  }, [currentPaid, currentSubmitted, additionalPaid, additionalDefaulted]);

  useEffect(() => {
    // When reduced motion is preferred, jump straight to the final value
    // instead of animating the score transition.
    if (reducedMotion) {
      setDisplayScore(projectedScore);
      return;
    }

    // Simple animation logic for the score transition
    if (typeof projectedScore === 'number') {
      const start = typeof displayScore === 'number' ? displayScore : 0;
      const end = projectedScore;
      const duration = 500;
      // Anchor on the first frame's timestamp: performance.now() is not
      // guaranteed to share a time origin with requestAnimationFrame, and a
      // negative elapsed time drove the displayed score far below the real one.
      let startTime: number | null = null;

      const animate = (currentTime: number) => {
        if (startTime === null) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(Math.max(elapsed / duration, 0), 1);
        const current = start + (end - start) * progress;

        setDisplayScore(Math.round(current));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    } else {
      setDisplayScore(projectedScore);
    }
  }, [projectedScore, reducedMotion]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: number) => void
  ) => {
    const val = parseInt(e.target.value);
    if (isNaN(val) || val < 0) {
      setter(0);
    } else {
      setter(val);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
      <div className="flex items-center space-x-2 mb-6">
        <TrendingUp className="w-5 h-5 text-indigo-600" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Score Impact Simulator</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label
              htmlFor="additionalPaid"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
            >
              Future Invoices Paid
            </label>
            <input
              type="number"
              id="additionalPaid"
              min="0"
              value={additionalPaid}
              onChange={(e) => handleInputChange(e, setAdditionalPaid)}
              className="w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Number of invoices you expect to pay on time.
            </p>
          </div>

          <div>
            <label
              htmlFor="additionalDefaulted"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
            >
              Future Invoices Defaulted
            </label>
            <input
              type="number"
              id="additionalDefaulted"
              min="0"
              value={additionalDefaulted}
              onChange={(e) => handleInputChange(e, setAdditionalDefaulted)}
              className="w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Number of invoices that might go into default.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-800">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 font-bold mb-2">
            Projected Score
          </p>
          <div className="text-6xl font-black text-indigo-600 dark:text-indigo-400 transition-all duration-300">
            {displayScore}
          </div>
          <div className="mt-4 flex items-center space-x-2 text-sm text-indigo-800 dark:text-indigo-300">
            {typeof projectedScore === 'number' && (
              <>
                <span>Current: {Math.round(currentScore)}</span>
                <span className="text-indigo-300">|</span>
                <span
                  className={
                    projectedScore > currentScore
                      ? 'text-green-600'
                      : projectedScore < currentScore
                        ? 'text-red-600'
                        : ''
                  }
                >
                  {projectedScore > currentScore ? '+' : ''}
                  {Math.round(projectedScore - currentScore)} impact
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex items-start space-x-3 text-gray-500 dark:text-gray-400">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed">
          <strong>Disclaimer:</strong> This is a simulation only based on the basic reputation
          formula. Actual score is calculated on-chain and may consider additional factors like
          time-weighting, volume, and protocol-specific weightings.
        </p>
      </div>
    </div>
  );
};
