'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface DestinationConfirmationInputProps {
  destinationAddress: string;
  onConfirmationChange: (isConfirmed: boolean) => void;
  requiredLength?: number;
  label?: string;
  className?: string;
}

/**
 * Security friction gate (Issue #669):
 * Requires the user to explicitly type the last N characters (default 6) of a
 * destination address before submitting irreversible fund/position transfers.
 * This defends against clipboard hijacking and accidental typos.
 */
export default function DestinationConfirmationInput({
  destinationAddress,
  onConfirmationChange,
  requiredLength = 6,
  label = 'Confirm Destination Address',
  className = '',
}: DestinationConfirmationInputProps) {
  const [typedSuffix, setTypedSuffix] = useState('');

  const trimmedAddress = destinationAddress.trim();
  const isValidTarget = trimmedAddress.length >= requiredLength;

  const expectedSuffix = useMemo(() => {
    if (!isValidTarget) return '';
    return trimmedAddress.slice(-requiredLength).toUpperCase();
  }, [trimmedAddress, isValidTarget, requiredLength]);

  const isConfirmed = useMemo(() => {
    if (!isValidTarget) return false;
    return typedSuffix.trim().toUpperCase() === expectedSuffix;
  }, [isValidTarget, typedSuffix, expectedSuffix]);

  useEffect(() => {
    onConfirmationChange(isConfirmed);
  }, [isConfirmed, onConfirmationChange]);

  // Reset confirmation input when target address changes
  useEffect(() => {
    setTypedSuffix('');
  }, [destinationAddress]);

  if (!isValidTarget) {
    return null;
  }

  const isPartiallyFilled = typedSuffix.trim().length > 0;
  const isMatch = isConfirmed;

  return (
    <div
      data-testid="destination-confirmation-gate"
      className={`rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <label
          htmlFor="destination-confirmation-input"
          className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px] text-amber-500">security</span>
          {label}
        </label>
        {isMatch ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Verified
          </span>
        ) : isPartiallyFilled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600">
            <span className="material-symbols-outlined text-[14px]">warning</span>
            Mismatch
          </span>
        ) : (
          <span className="text-xs text-on-surface-variant font-medium">
            Type last {requiredLength} chars
          </span>
        )}
      </div>

      <p className="text-xs text-on-surface-variant">
        To prevent address spoofing and clipboard hijacking, type the last{' '}
        <span className="font-mono font-bold text-on-surface">{requiredLength}</span> characters (
        <span className="font-mono font-bold text-primary">...{expectedSuffix}</span>) of the
        destination address:
      </p>

      <div className="relative">
        <input
          id="destination-confirmation-input"
          type="text"
          maxLength={requiredLength + 2}
          value={typedSuffix}
          onChange={(e) => setTypedSuffix(e.target.value)}
          placeholder={`e.g. ${expectedSuffix}`}
          className={`w-full rounded-xl border bg-surface-container px-4 py-2.5 font-mono text-sm uppercase tracking-widest text-on-surface placeholder:normal-case placeholder:tracking-normal placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 ${
            isMatch
              ? 'border-emerald-500/50 focus:ring-emerald-500'
              : isPartiallyFilled
                ? 'border-amber-500/50 focus:ring-amber-500'
                : 'border-outline-variant/30 focus:ring-primary'
          }`}
        />
      </div>
    </div>
  );
}
