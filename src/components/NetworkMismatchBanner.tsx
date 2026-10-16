'use client';

import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { formatNetworkLabel } from '@/utils/network';

export default function NetworkMismatchBanner() {
  const {
    networkMismatch,
    mismatchDetails,
    switchingNetwork,
    walletNetwork,
    isConnected,
    switchNetwork,
  } = useWallet();

  if (!isConnected || !networkMismatch || !walletNetwork || !mismatchDetails) {
    return null;
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-[60] border-b border-error/30 bg-error-container/95 text-on-error-container backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Network mismatch</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-on-error-container/90">
            {mismatchDetails.walletMismatch && (
              <li>
                Wallet is on <strong>{formatNetworkLabel(mismatchDetails.walletNetwork)}</strong>,
                but this app is configured for{' '}
                <strong>{formatNetworkLabel(mismatchDetails.appNetwork)}</strong>.
              </li>
            )}
            {mismatchDetails.rpcMismatch && mismatchDetails.rpcNetwork && (
              <li>
                RPC endpoint targets{' '}
                <strong>{formatNetworkLabel(mismatchDetails.rpcNetwork)}</strong>, but your wallet
                is on <strong>{formatNetworkLabel(mismatchDetails.walletNetwork)}</strong>.
              </li>
            )}
          </ul>
        </div>
        <button
          type="button"
          disabled={switchingNetwork}
          onClick={switchNetwork}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-on-error-container px-3 py-1.5 text-sm font-medium text-error-container transition-colors hover:bg-on-error-container/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {switchingNetwork ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Switching...
            </>
          ) : (
            <>
              Switch to {formatNetworkLabel(mismatchDetails.appNetwork)}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
