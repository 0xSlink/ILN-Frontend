'use client';

import { useEffect, useState } from 'react';
import { STELLAR_NETWORK } from '@/constants';
import { useToast } from '@/context/ToastContext';
import { useWallet } from '@/context/WalletContext';
import { getNativeXlmBalance } from '@/utils/soroban';

const MINIMUM_XLM_BALANCE = 2;

export default function TestnetFaucetButton() {
  const { address, isConnected, networkMismatch } = useWallet();
  const { addToast, updateToast } = useToast();
  const [xlmBalance, setXlmBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isFunding, setIsFunding] = useState(false);

  const isTestnet = STELLAR_NETWORK.toLowerCase() === 'testnet';
  const hasSufficientBalance = xlmBalance !== null && xlmBalance >= MINIMUM_XLM_BALANCE;

  useEffect(() => {
    let cancelled = false;

    async function loadBalance() {
      if (!isTestnet || !address || !isConnected || networkMismatch) {
        setXlmBalance(null);
        return;
      }

      setIsLoadingBalance(true);
      try {
        const balance = await getNativeXlmBalance(address);
        if (!cancelled) setXlmBalance(balance);
      } catch {
        if (!cancelled) setXlmBalance(null);
      } finally {
        if (!cancelled) setIsLoadingBalance(false);
      }
    }

    void loadBalance();

    return () => {
      cancelled = true;
    };
  }, [address, isConnected, isTestnet, networkMismatch]);

  if (!isTestnet || !address || !isConnected || networkMismatch) return null;

  const handleFund = async () => {
    setIsFunding(true);
    const toastId = addToast({ type: 'pending', title: 'Requesting testnet XLM...' });

    try {
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`
      );
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Friendbot request failed.');
      }

      const previousBalance = xlmBalance ?? 0;
      const nextBalance = await getNativeXlmBalance(address);
      const fundedAmount = Math.max(0, nextBalance - previousBalance);
      setXlmBalance(nextBalance);
      updateToast(toastId, {
        type: 'success',
        title: 'Testnet XLM received',
        message: `Funded ${fundedAmount.toFixed(2)} XLM. Current balance: ${nextBalance.toFixed(2)} XLM.`,
      });
    } catch (error) {
      updateToast(toastId, {
        type: 'error',
        title: 'Faucet failed',
        message: error instanceof Error ? error.message : 'Friendbot could not fund this wallet.',
      });
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleFund}
      disabled={isFunding || isLoadingBalance || hasSufficientBalance}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-55"
      title={
        hasSufficientBalance
          ? `Wallet already has ${xlmBalance.toFixed(2)} XLM`
          : 'Request testnet XLM from Stellar Friendbot'
      }
    >
      <span className="material-symbols-outlined text-[16px]">add_circle</span>
      {hasSufficientBalance ? 'XLM funded' : isFunding ? 'Funding...' : 'Get Testnet XLM'}
    </button>
  );
}
