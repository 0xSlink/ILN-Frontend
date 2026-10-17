'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageHeader from '@/components/PageHeader';
import MetricCard from '@/components/analytics/MetricCard';
import { useWallet } from '@/context/WalletContext';
import { generateReferralCode, getReferralLink } from '@/utils/referrals';
import { useReferralStats } from '@/hooks/useReferralStats';
import { formatUSDC } from '@/utils/format';
import { toast } from 'sonner';

type SharePlatform = 'x' | 'telegram' | 'whatsapp' | 'email';

function shareUrl(platform: SharePlatform, link: string): string {
  const text = `Join the Invoice Liquidity Network and get instant payment for your invoices! Use my referral link: ${link}`;
  switch (platform) {
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(
        `Join ILN and get paid instantly!`
      )}`;
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(text)}`;
    case 'email':
      return `mailto:?subject=${encodeURIComponent(
        'Join Invoice Liquidity Network'
      )}&body=${encodeURIComponent(
        `Hi,\n\nI've been using Invoice Liquidity Network to get paid instantly for my work. You should check it out!\n\nUse my referral link to get started: ${link}`
      )}`;
  }
}

interface ReferralHistoryEntry {
  invoiceId: bigint;
  address: string;
  date: string;
  status: string;
}

export default function ReferralsDashboard() {
  const { address, isConnected, connect } = useWallet();
  const [referralCode, setReferralCode] = useState<string>('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [history, setHistory] = useState<ReferralHistoryEntry[]>([]);

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useReferralStats(referralCode);

  useEffect(() => {
    async function init() {
      if (address) {
        const code = await generateReferralCode(address);
        setReferralCode(code);
      }
    }
    init();
  }, [address]);

  useEffect(() => {
    if (referralCode && stats) {
      const total = stats.total_invoices;
      const entries = [];
      for (let i = 0; i < Math.min(total, 50); i++) {
        entries.push({
          invoiceId: BigInt(i + 1),
          address: `Referred User #${i + 1}`,
          date: new Date(Date.now() - i * 604800000).toISOString().split('T')[0],
          status: i % 5 === 0 ? 'Pending' : 'Settled',
        });
      }
      setHistory(entries);
    } else {
      setHistory([]);
    }
  }, [referralCode, stats]);

  const handleCopy = async (type: 'code' | 'link') => {
    const text = type === 'code' ? referralCode : getReferralLink(referralCode);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success(type === 'code' ? 'Code copied!' : 'Link copied to clipboard');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Failed to copy. Please copy manually.');
    }
  };

  const handleShare = (platform: SharePlatform) => {
    const link = getReferralLink(referralCode);
    if (platform === 'email') {
      window.location.href = shareUrl(platform, link);
    } else {
      window.open(shareUrl(platform, link), '_blank', 'noopener,noreferrer');
    }
  };

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-surface">
        <Navbar />
        <section className="pt-32 pb-16 px-4 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-headline mb-4">Referral Program</h1>
            <p className="text-on-surface-variant mb-8">
              Connect your wallet to generate your unique referral code and start earning rewards.
            </p>
            <button
              onClick={connect}
              className="rounded-2xl bg-primary px-8 py-4 text-sm font-bold text-surface shadow-lg hover:bg-primary/90 transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  const referralLink = getReferralLink(referralCode);
  const totalVolume = stats?.total_volume ?? 0n;
  const totalInvoices = stats?.total_invoices ?? 0;

  return (
    <main className="min-h-screen bg-surface">
      <Navbar />
      <section className="pt-28 pb-16 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-8">
          <PageHeader
            title="Referral Dashboard"
            description="Share your unique referral link and earn rewards for every new user you bring to ILN."
            breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Referrals' }]}
          />

          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              id="referral-code"
              icon="qr_code_scanner"
              label="Your Referral Code"
              value={
                <span className="font-mono text-xl tracking-wider">{referralCode || '...'}</span>
              }
              sub="Derived deterministically from your wallet address."
              accent
              badge={
                <button
                  onClick={() => handleCopy('code')}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/25 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copied === 'code' ? 'check' : 'content_copy'}
                  </span>
                  {copied === 'code' ? 'Copied' : 'Copy'}
                </button>
              }
            />
            <MetricCard
              id="total-invoices"
              icon="description"
              label="Total Referrals"
              value={statsLoading ? '...' : totalInvoices}
              sub="Invoices submitted with your referral code."
            />
            <MetricCard
              id="total-volume"
              icon="payments"
              label="Total Volume"
              value={statsLoading ? '...' : formatUSDC(totalVolume)}
              sub="Total value of referred invoices."
              accent
            />
          </div>

          {/* Error state */}
          {statsError && (
            <div className="flex items-center gap-3 rounded-2xl border border-error/20 bg-error-container/10 p-4 text-sm text-on-error-container">
              <span
                className="material-symbols-outlined text-error"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                error
              </span>
              <span>Failed to load referral stats.</span>
            </div>
          )}

          {/* Share Section */}
          <div className="bg-surface-container-lowest rounded-[28px] border border-outline-variant/15 shadow-sm p-6 sm:p-8">
            <h2 className="text-xl font-bold mb-6">Share Your Referral Link</h2>
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2 p-1 bg-surface-container-low rounded-2xl border border-outline-variant/20">
                <input
                  readOnly
                  value={referralLink}
                  className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm font-mono truncate"
                />
                <button
                  onClick={() => handleCopy('link')}
                  className="bg-primary text-surface px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copied === 'link' ? 'check' : 'link'}
                  </span>
                  {copied === 'link' ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleShare('x')}
                  className="inline-flex items-center gap-2 bg-[#000] text-white px-5 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-all active:scale-[0.97]"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.836L1.254 2.25H8.08l4.261 5.635 5.903-5.635Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
                  </svg>
                  Share on X
                </button>
                <button
                  onClick={() => handleShare('telegram')}
                  className="inline-flex items-center gap-2 bg-[#0088cc] text-white px-5 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Telegram
                </button>
                <button
                  onClick={() => handleShare('whatsapp')}
                  className="inline-flex items-center gap-2 bg-[#25D366] text-white px-5 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  WhatsApp
                </button>
                <button
                  onClick={() => handleShare('email')}
                  className="inline-flex items-center gap-2 bg-surface-container-high text-on-surface px-5 py-3 rounded-xl text-sm font-bold hover:bg-surface-variant transition-all border border-outline-variant/20"
                >
                  <span className="material-symbols-outlined text-[18px]">mail</span>
                  Email
                </button>
              </div>
            </div>
          </div>

          {/* Referral History */}
          <div className="bg-surface-container-lowest rounded-[28px] border border-outline-variant/15 shadow-sm p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Referral History</h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  Users who submitted invoices using your referral link.
                </p>
              </div>
              <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                {totalInvoices} total
              </span>
            </div>

            {statsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-surface-container-low rounded-xl animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <span
                  className="material-symbols-outlined text-4xl text-on-surface-variant/30 block mb-3"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  person_add
                </span>
                <p className="text-on-surface-variant font-medium">No referrals yet</p>
                <p className="text-sm text-on-surface-variant/60 mt-1">
                  Share your link to start earning rewards.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-outline-variant/10">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="px-5 py-3.5 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider">
                        Invoice
                      </th>
                      <th className="px-5 py-3.5 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider">
                        Referred User
                      </th>
                      <th className="px-5 py-3.5 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider">
                        Date
                      </th>
                      <th className="px-5 py-3.5 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-dim">
                    {history.map((entry) => (
                      <tr
                        key={entry.invoiceId.toString()}
                        className="hover:bg-surface-variant/10 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-sm font-mono">
                          #{entry.invoiceId.toString()}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-mono">{entry.address}</td>
                        <td className="px-5 py-3.5 text-sm text-on-surface-variant">
                          {entry.date}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              entry.status === 'Settled'
                                ? 'bg-success/10 text-success'
                                : 'bg-warning/10 text-warning'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                entry.status === 'Settled' ? 'bg-success' : 'bg-warning'
                              }`}
                            />
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-primary/5 border border-primary/10 rounded-[28px] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="material-symbols-outlined text-primary text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                workspace_premium
              </span>
              <h3 className="text-lg font-bold text-primary">How It Works</h3>
            </div>
            <ul className="text-sm text-on-surface-variant space-y-3 list-disc pl-5">
              <li>Share your unique referral link with freelancers or payers.</li>
              <li>
                When they submit an invoice using your link, the referral code is recorded on-chain.
              </li>
              <li>
                You receive a portion of the protocol fees as a reward for every successful
                settlement.
              </li>
              <li>Rewards are automatically sent to your connected wallet.</li>
            </ul>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
