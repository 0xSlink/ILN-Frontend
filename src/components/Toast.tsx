'use client';

import React, { useState, useRef, useEffect } from 'react';
import { NETWORK_NAME } from '@/constants';
import type { ToastMessage } from '@/context/ToastContext';
import { getExplorerTxUrl } from '@/utils/explorer';

interface ToastProps {
  toast: ToastMessage;
  onClose: () => void;
}

const DISMISS_THRESHOLD = 0.5;

export default function Toast({ toast, onClose }: ToastProps) {
  const { type, title, message, txHash, action } = toast;

  const isPending = type === 'pending';
  const isSuccess = type === 'success';
  const isError = type === 'error';
  const explorerUrl = getExplorerTxUrl(txHash, NETWORK_NAME);

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const toastRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentX = e.touches[0].clientX;
    const deltaX = currentX - startX.current;

    if (deltaX > 0) {
      setDragX(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    const toastWidth = toastRef.current?.offsetWidth || 300;
    const dragPercentage = dragX / toastWidth;

    if (dragPercentage >= DISMISS_THRESHOLD) {
      triggerHapticFeedback();
      onClose();
    } else {
      setDragX(0);
    }

    setIsDragging(false);
  };

  const triggerHapticFeedback = () => {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(50);
    }
  };

  useEffect(() => {
    if (!isDragging && dragX !== 0) {
      setDragX(0);
    }
  }, [isDragging, dragX]);

  const toastWidth = toastRef.current?.offsetWidth || 300;
  const dragPercentage = Math.min(dragX / toastWidth, 1);
  const opacity = 1 - dragPercentage * 0.5;
  const translateX = dragX;

  return (
    <div
      ref={toastRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`min-w-[300px] p-4 rounded-lg shadow-lg border flex items-start gap-3 transition-all duration-300 transform ${
        isDragging ? 'transition-none' : ''
      }`}
      style={{
        transform: `translateX(${translateX}px)`,
        opacity,
        touchAction: 'pan-y',
      }}
    >
      <div
        className={`flex-1 ${
          isSuccess
            ? 'bg-[#e8f5e9] border-[#c8e6c9] text-[#2e7d32] dark:bg-[#1b5e20]/20 dark:border-[#2e7d32]/30 dark:text-[#81c784]'
            : isError
              ? 'bg-[#ffebee] border-[#ffcdd2] text-[#c62828] dark:bg-[#b71c1c]/20 dark:border-[#c62828]/30 dark:text-[#e57373]'
              : 'bg-surface-container-highest border-outline-variant/30 text-on-surface'
        } rounded-lg p-4`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 min-w-[24px]">
            {isPending && (
              <span className="material-symbols-outlined animate-spin text-primary">sync</span>
            )}
            {isSuccess && (
              <span className="material-symbols-outlined text-[#2e7d32] dark:text-[#81c784]">
                check_circle
              </span>
            )}
            {isError && (
              <span className="material-symbols-outlined text-[#c62828] dark:text-[#e57373]">
                error
              </span>
            )}
          </div>

          <div className="flex-1">
            <h4 className="font-bold text-sm tracking-wide">{title}</h4>
            {message && <p className="text-xs mt-1 opacity-90">{message}</p>}
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] underline mt-2 block opacity-80 hover:opacity-100 uppercase tracking-widest"
              >
                <span className="flex items-center gap-1">
                  View on Stellar Expert
                  <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                </span>
              </a>
            )}
            {action && (
              <button
                onClick={action.onClick}
                className="mt-3 rounded-full border border-outline-variant/50 bg-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface transition-colors hover:bg-surface-variant"
              >
                {action.label}
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="opacity-50 hover:opacity-100 transition-opacity ml-2"
            aria-label="Close toast"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      </div>

      {dragPercentage > 0 && (
        <div
          className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-primary/20 to-transparent rounded-lg"
          style={{ opacity: dragPercentage }}
        />
      )}
    </div>
  );
}
