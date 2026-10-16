import React, { useState } from 'react';
import { NEXT_PUBLIC_INSURANCE_POOL_ENABLED } from '@/constants';
import { useInsurance } from '@/hooks/useInsurance';
import { useTransaction } from '@/hooks/useTransaction';
import { useWallet } from '@/context/WalletContext';
import { depositPremium, submitSignedTransaction } from '@/utils/soroban';
import { formatTokenAmount } from '@/utils/format';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';

export default function InsurancePoolPanel() {
  const { poolInfo, isEnrolled, isLoading, refresh } = useInsurance();
  const { execute } = useTransaction();
  const { address } = useWallet();
  const { defaultToken } = useApprovedTokens();
  const [premiumAmount, setPremiumAmount] = useState('100');

  const isEnabled =
    NEXT_PUBLIC_INSURANCE_POOL_ENABLED || process.env.NEXT_PUBLIC_INSURANCE_POOL_ENABLED === 'true';
  if (!isEnabled) return null;

  const handleEnroll = async () => {
    if (!address) return;

    const amount = BigInt(parseFloat(premiumAmount) * 10 ** (defaultToken?.decimals ?? 7));

    await execute(
      async (signTx) => {
        const tx = await depositPremium(address, amount);
        return submitSignedTransaction({ tx, signTx });
      },
      {
        title: 'Enrolling in Protection',
        successTitle: 'Enrolled Successfully',
        successMessage: `You have deposited ${premiumAmount} ${defaultToken?.symbol ?? 'USDC'} into the insurance pool.`,
      }
    );
    refresh();
  };

  if (isLoading) {
    return (
      <div className="bg-surface-container-low p-6 rounded-2xl animate-pulse">
        <div className="h-6 w-48 bg-surface-variant rounded mb-4" />
        <div className="h-20 w-full bg-surface-variant rounded" />
      </div>
    );
  }

  const coverageMonths = 12; // Example health indicator logic

  return (
    <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">verified_user</span>
            Default Protection
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            Insure your positions against invoice defaults via the protocol pool.
          </p>
        </div>
        {isEnrolled ? (
          <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Enrolled
          </span>
        ) : (
          <span className="bg-surface-variant text-on-surface-variant text-xs font-bold px-3 py-1 rounded-full">
            Not Enrolled
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/5">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">
            Pool Balance
          </p>
          <p className="text-xl font-headline">
            {poolInfo ? formatTokenAmount(poolInfo.balance, defaultToken ?? undefined) : '0'}
            <span className="text-xs ml-1 text-on-surface-variant font-sans">
              {defaultToken?.symbol}
            </span>
          </p>
        </div>
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/5">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">
            Enrolled LPs
          </p>
          <p className="text-xl font-headline">{poolInfo?.enrolled_count ?? 0}</p>
        </div>
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/5">
          <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">
            Premium Rate
          </p>
          <p className="text-xl font-headline">{(poolInfo?.premium_rate ?? 0) / 100}%</p>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Pool Health
          </span>
          <span className="text-xs font-medium text-green-600">Stable</span>
        </div>
        <div className="h-3 w-full bg-surface-container-highest rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: '85%' }} />
        </div>
        <p className="text-[11px] text-on-surface-variant mt-2 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">info</span>
          Pool covers {coverageMonths} months of average defaults at current volume.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <input
            type="number"
            value={premiumAmount}
            onChange={(e) => setPremiumAmount(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-4 pr-12 font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            placeholder="Amount"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">
            {defaultToken?.symbol}
          </span>
        </div>
        <button
          onClick={handleEnroll}
          className="w-full sm:w-auto bg-primary text-surface-container-lowest px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-md shadow-primary/10 whitespace-nowrap"
        >
          {isEnrolled ? 'Deposit More Premium' : 'Enroll in Protection'}
        </button>
      </div>
    </div>
  );
}
