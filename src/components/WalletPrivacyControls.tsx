'use client';

import { useState } from 'react';

/**
 * Storage + disconnect controls for the connected wallet (#1156).
 *
 * Extracted as a pure, prop-driven presentational component so the exact
 * privacy controls (copy/persist the public address, and disconnect which also
 * clears every wallet-scoped storage trace) can be locked in visual-regression
 * snapshots across responsive viewports and dark mode without a wallet context.
 */

export interface WalletPrivacyControlsProps {
  /** The connected wallet address (G-address). */
  address: string;
  /** Invoked when the user clicks Disconnect (clears session + storage upstream). */
  onDisconnect: () => void;
  /** Optional override for the copy behaviour (tests / visual isolation). */
  onCopy?: (address: string) => Promise<void> | void;
}

export function WalletPrivacyControls({
  address,
  onDisconnect,
  onCopy,
}: WalletPrivacyControlsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    try {
      if (onCopy) {
        await onCopy(address);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(address);
      } else {
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — nothing actionable to surface.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void handleCopyAddress();
        }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-container-highest text-sm text-on-surface w-full text-left transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">
          {copied ? 'check' : 'content_copy'}
        </span>
        {copied ? 'Copied!' : 'Copy Address'}
      </button>
      <button
        type="button"
        onClick={onDisconnect}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-error-container hover:text-on-error-container text-error text-sm w-full text-left transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">logout</span>
        Disconnect
      </button>
    </>
  );
}

export default WalletPrivacyControls;
