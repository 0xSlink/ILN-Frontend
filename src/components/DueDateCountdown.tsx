'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface DueDateCountdownProps {
  dueDate: bigint;
  onClaimDefault?: () => void;
  showClaimButton?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  isOverdue: boolean;
  totalHours: number;
}

function calculateTimeRemaining(dueDate: bigint): TimeRemaining {
  const nowMs = Date.now();
  const dueMs = Number(dueDate) * 1000;
  const diffMs = dueMs - nowMs;

  const isOverdue = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);

  const totalHours = Math.floor(absDiffMs / (1000 * 60 * 60));
  const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, isOverdue, totalHours };
}

function formatTimeDisplay(time: TimeRemaining): {
  text: string;
  className: string;
  shouldPulse: boolean;
} {
  if (time.isOverdue) {
    return {
      text: 'Expired',
      className:
        'inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-bold text-gray-600',
      shouldPulse: false,
    };
  }

  const totalHours = time.totalHours;
  const days = time.days;

  if (totalHours < 24) {
    // Less than 24 hours: "X hrs Y mins" with red text + pulse
    return {
      text: `${time.hours}h ${time.minutes}m`,
      className: 'text-red-500 font-semibold',
      shouldPulse: true,
    };
  }

  if (days <= 7) {
    // 1-7 days: "X days Y hrs" with orange text
    return {
      text: `${days}d ${time.hours}h`,
      className: 'text-amber-500 font-semibold',
      shouldPulse: false,
    };
  }

  // More than 7 days: "X days Y hrs" with green color
  return {
    text: `${days}d ${time.hours}h`,
    className: 'text-green-500 font-semibold',
    shouldPulse: false,
  };
}

export default function DueDateCountdown({
  dueDate,
  onClaimDefault,
  showClaimButton = false,
}: DueDateCountdownProps) {
  const [time, setTime] = useState<TimeRemaining>(() => calculateTimeRemaining(dueDate));
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  // Update timer every 60 seconds
  useEffect(() => {
    // Initial calculation
    setTime(calculateTimeRemaining(dueDate));

    const intervalId = setInterval(() => {
      setTime(calculateTimeRemaining(dueDate));
    }, 60_000); // 60 seconds

    return () => clearInterval(intervalId);
  }, [dueDate]);

  const display = useMemo(() => formatTimeDisplay(time), [time]);
  const dueDateLocal = useMemo(() => new Date(Number(dueDate) * 1000), [dueDate]);

  const formattedDueDate = useMemo(() => {
    return dueDateLocal.toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }, [dueDateLocal]);

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <span
          className={`cursor-help ${display.className} ${display.shouldPulse ? 'animate-pulse-fast' : ''}`}
          onMouseEnter={() => setIsTooltipVisible(true)}
          onMouseLeave={() => setIsTooltipVisible(false)}
          onFocus={() => setIsTooltipVisible(true)}
          onBlur={() => setIsTooltipVisible(false)}
          tabIndex={0}
          role="button"
          aria-label={`Due date: ${formattedDueDate}`}
        >
          {display.text}
        </span>

        {/* Tooltip */}
        {isTooltipVisible && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-dim text-on-surface text-xs rounded-lg shadow-lg border border-outline-variant/20 whitespace-nowrap z-[200]"
            role="tooltip"
          >
            <div className="font-semibold mb-0.5">Due Date</div>
            <div className="text-on-surface-variant">{formattedDueDate}</div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-surface-dim" />
            </div>
          </div>
        )}
      </div>

      {/* Claim Default Button - only shown when overdue */}
      {time.isOverdue && showClaimButton && onClaimDefault && (
        <button
          onClick={onClaimDefault}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors active:scale-95 shadow-sm"
          aria-label="Claim default on this invoice"
        >
          <span className="material-symbols-outlined text-[14px]">gavel</span>
          Claim default
        </button>
      )}
    </div>
  );
}
