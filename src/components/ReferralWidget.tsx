'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DataSourceCaption from '@/components/DataSourceCaption';
import { useWallet } from '@/context/WalletContext';
import { generateReferralCode, getReferralLink } from '@/utils/referrals';
import { useReferralStats } from '@/hooks/useReferralStats';
import { formatUSDC } from '@/utils/format';
import { toast } from 'sonner';

export default function ReferralWidget() {
  const { address, isConnected } = useWallet();
  const [referralCode, setReferralCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const { data: stats, isLoading: statsLoading } = useReferralStats(referralCode);

  useEffect(() => {
    async function init() {
      if (address) {
        const code = await generateReferralCode(address);
        setReferralCode(code);
      }
    }
    init();
  }, [address]);

  const handleCopy = async () => {
    const link = getReferralLink(referralCode);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link.');
    }
  };

  if (!isConnected) return null;

  const totalVolume = stats?.total_volume ?? null;
  const totalInvoices = stats?.total_invoices ?? null;

  return (
    <div className="mt-8 rounded-[24px] border border-outline-variant/15 bg-surface-container-lowest p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold">Referral Program</h3>
          <p className="text-sm text-on-surface-variant mt-1">
            Invite users and earn a portion of the protocol fees.
          </p>
        </div>
        <Link href="/referrals" className="text-sm font-bold text-primary hover:underline">
          View Full Dashboard →
        </Link>
      </div>
      <DataSourceCaption
        metric="wallet-referral-stats"
        provenance={stats ? 'rpc' : 'unavailable'}
        className="mb-4"
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {/* Referral Count */}
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Referrals
          </p>
          <p className="text-2xl font-headline font-medium text-primary">
            {statsLoading ? '...' : totalInvoices === null ? 'Unavailable' : totalInvoices}
          </p>
        </div>

        {/* Total Rewards Earned / Volume */}
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Total Rewards Earned
          </p>
          <p className="text-2xl font-headline font-medium text-primary">
            {statsLoading ? '...' : 'Unavailable'}
          </p>
          <p className="text-[10px] text-on-surface-variant mt-1">
            {totalVolume === null
              ? 'Reward and volume data are unavailable.'
              : `From ${formatUSDC(totalVolume)} total volume`}
          </p>
        </div>

        {/* Share Button */}
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 flex flex-col justify-center">
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-surface transition-colors hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copied ? 'check' : 'share'}
            </span>
            {copied ? 'Link Copied!' : 'Share Referral Link'}
          </button>
        </div>
      </div>

      {/* Recent Referrals */}
      <div>
        <h4 className="text-sm font-bold mb-3">Recent Referrals</h4>
        {statsLoading ? (
          <div className="space-y-2">
            <div className="h-10 bg-surface-container-low rounded-lg animate-pulse" />
            <div className="h-10 bg-surface-container-low rounded-lg animate-pulse" />
          </div>
        ) : !stats ? (
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-6 text-center">
            <p className="text-sm text-on-surface-variant">
              Recent referral details are unavailable.
            </p>
          </div>
        ) : totalInvoices === 0 ? (
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-6 text-center">
            <p className="text-sm text-on-surface-variant">
              No referrals yet. Share your link to get started!
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-6 text-center">
            <p className="text-sm text-on-surface-variant">
              Recent referral records are unavailable from the current contract read.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
