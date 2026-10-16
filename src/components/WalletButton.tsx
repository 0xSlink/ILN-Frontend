'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';
import { useBalances } from '@/hooks/useBalances';
import { useWallet } from '@/context/WalletContext';
import { TokenAmount } from './TokenSelector';
import { formatAddress, formatTokenAmount } from '@/utils/format';
import { NETWORK_NAME } from '@/constants';
import TestnetFaucetButton from './TestnetFaucetButton';

export default function WalletButton() {
  const {
    address,
    isConnected,
    isInstalled,
    isReconnecting,
    preferredWalletProvider,
    connect,
    disconnect,
    networkMismatch,
    error,
  } = useWallet();
  const { tokens } = useApprovedTokens();
  const allowedTokens = useMemo(() => tokens.filter((token) => token.isAllowed), [tokens]);
  // Auto-refreshes every 30s and on each successful transaction; tokens that
  // fail to load surface via `unavailable` for the "Add Trustline" prompt.
  const { balances, unavailable, isLoading: isLoadingBalances } = useBalances(tokens);
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — nothing actionable to surface.
    }
  };

  if (isConnected) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-outline-variant/15 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50
            ${dropdownOpen ? 'bg-surface-container' : 'bg-surface-container-low hover:bg-surface-container'}
          `}
          title={address!}
          aria-expanded={dropdownOpen}
        >
          <span
            className={`w-2 h-2 rounded-full ${networkMismatch ? 'bg-error animate-pulse' : 'bg-green-500'}`}
            aria-label={networkMismatch ? 'Wrong network' : 'Connected'}
          />
          <span
            className={`text-[10px] font-bold uppercase ${networkMismatch ? 'text-error' : 'text-primary'}`}
          >
            {networkMismatch ? 'Wrong Network' : NETWORK_NAME}
          </span>
          <span className="text-on-surface-variant/30">|</span>
          <span
            className={`text-sm font-mono font-medium ${networkMismatch ? 'text-error' : 'text-on-surface'}`}
          >
            {formatAddress(address!)}
          </span>
          <span
            className="material-symbols-outlined text-[16px] text-on-surface-variant transition-transform duration-200"
            style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none' }}
          >
            expand_more
          </span>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 min-w-[240px] rounded-xl border border-outline-variant/20 bg-surface-container-high shadow-xl z-[60] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {!networkMismatch && (
              <div className="flex flex-col gap-1.5 p-3">
                <p className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/70">
                  Balances
                </p>
                {isLoadingBalances && balances.size === 0 && unavailable.size === 0 ? (
                  <p className="px-1 text-xs text-on-surface-variant">Loading balances...</p>
                ) : (
                  allowedTokens.map((token) => {
                    const amount = balances.get(token.contractId);
                    const isUnavailable = unavailable.has(token.contractId);
                    // Not yet loaded and not flagged unavailable — skip until it resolves.
                    if (amount === undefined && !isUnavailable) return null;

                    return (
                      <div
                        key={token.contractId}
                        className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm font-bold text-on-surface"
                      >
                        <TokenAmount
                          amount={formatTokenAmount(amount ?? 0n, token)}
                          token={token}
                        />
                        {isUnavailable ? (
                          <button
                            type="button"
                            onClick={connect}
                            title={`No ${token.symbol} trustline found for this wallet. Add one to hold ${token.symbol}.`}
                            className="rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-primary-container hover:bg-primary-container/80 transition-colors"
                          >
                            Add Trustline
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div className="flex flex-col gap-1 border-t border-outline-variant/10 p-2">
              <TestnetFaucetButton />
              <button
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
                onClick={() => {
                  disconnect();
                  setDropdownOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-error-container hover:text-on-error-container text-error text-sm w-full text-left transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const connectionLabel = isReconnecting ? 'Reconnecting...' : 'Connect Wallet';

  return (
    <div className="relative group">
      <button
        onClick={connect}
        disabled={isReconnecting}
        className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-surface-container-lowest shadow-md transition-all duration-150 hover:bg-primary/90 active:scale-95 disabled:cursor-wait disabled:opacity-70"
      >
        <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
        {connectionLabel}
      </button>
      {isReconnecting && (
        <p className="mt-2 text-xs text-on-surface-variant">
          Attempting to restore your wallet session…
        </p>
      )}
      {!isInstalled && !isReconnecting && preferredWalletProvider !== 'walletconnect' && (
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex min-h-[44px] items-center justify-end text-[11px] font-medium text-primary hover:underline"
        >
          Don&apos;t have Freighter? Install it →
        </a>
      )}
      {error && (
        <div className="absolute top-full right-0 mt-2 p-3 bg-error-container text-on-error-container text-xs rounded-lg shadow-xl border border-error/10 w-64 z-[60] animate-in slide-in-from-top-1 duration-200">
          <p className="font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">error</span>
            Connection Error
          </p>
          <p className="mt-1 opacity-90">{error}</p>
        </div>
      )}
    </div>
  );
}
