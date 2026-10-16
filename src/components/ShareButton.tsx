'use client';

import { useState, useMemo } from 'react';
import type { Invoice } from '@/utils/soroban';
import { tokenAmountToNumber } from '@/utils/format';

const TWEET_MAX_CHARS = 280;

interface ShareButtonProps {
  invoice: Invoice;
  userAddress: string | null;
  baseUrl?: string;
}

function buildFreelancerTweet(invoice: Invoice, shareUrl: string): string {
  const amount = tokenAmountToNumber(invoice.amount).toFixed(2);
  return (
    `Just got paid on-chain via @ILNProtocol on @stellar ` +
    `Invoice #${invoice.id.toString()} — ${amount} USDC settled in seconds. ` +
    `No bank, no delay. ${shareUrl}`
  );
}

function buildLPTweet(invoice: Invoice, shareUrl: string): string {
  const yieldAmount = (
    (Number(invoice.amount) * invoice.discount_rate) /
    10_000 /
    1_000_000
  ).toFixed(2);
  const rate = (invoice.discount_rate / 100).toFixed(2);
  const now = Math.floor(Date.now() / 1000);
  const fundedAt = invoice.funded_at ? Number(invoice.funded_at) : now;
  const settlementDays = Math.max(1, Math.round((now - fundedAt) / 86400));
  return (
    `Earned ${yieldAmount} USDC yield on Invoice #${invoice.id.toString()} ` +
    `via @ILNProtocol on @stellar — ${rate}% return in ${settlementDays} day${settlementDays !== 1 ? 's' : ''}. ` +
    shareUrl
  );
}

function truncateTweet(text: string, shareUrl: string): string {
  if (text.length <= TWEET_MAX_CHARS) return text;
  // Always preserve the URL at the end; trim the body
  const urlLength = shareUrl.length;
  const maxBody = TWEET_MAX_CHARS - urlLength - 4; // 4 = " ..." + space
  const truncated = text.slice(0, text.indexOf(shareUrl)).trimEnd();
  return truncated.slice(0, maxBody) + '... ' + shareUrl;
}

export default function ShareButton({ invoice, userAddress, baseUrl }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const isFreelancer = userAddress === invoice.freelancer;
  const isLP = !!invoice.funder && userAddress === invoice.funder;

  const shareUrl = useMemo(() => {
    const origin = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
    return `${origin}/pay/${invoice.id.toString()}`;
  }, [invoice.id, baseUrl]);

  const tweetText = useMemo(() => {
    const raw = isFreelancer
      ? buildFreelancerTweet(invoice, shareUrl)
      : buildLPTweet(invoice, shareUrl);
    return truncateTweet(raw, shareUrl);
  }, [invoice, shareUrl, isFreelancer]);

  const charCount = tweetText.length;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tweetText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silent fallback
    }
  };

  if (invoice.status !== 'Paid') return null;
  if (!isFreelancer && !isLP) return null;

  return (
    <div className="flex items-center gap-2">
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X / Twitter"
        className="inline-flex items-center gap-2 rounded-2xl bg-[#000] px-5 py-3 text-sm font-bold text-white shadow hover:bg-neutral-800 transition-all active:scale-[0.97]"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-4 w-4 fill-white"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.836L1.254 2.25H8.08l4.261 5.635 5.903-5.635Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
        Share on X
      </a>
      <button
        onClick={() => void handleCopy()}
        aria-label="Copy tweet to clipboard"
        className="inline-flex items-center gap-1.5 rounded-2xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-all"
      >
        <span className="material-symbols-outlined text-[16px]">
          {copied ? 'check' : 'content_copy'}
        </span>
        {copied ? 'Copied!' : 'Copy text'}
      </button>
      <span
        className={`text-xs font-mono ${charCount > TWEET_MAX_CHARS ? 'text-red-500' : 'text-on-surface-variant/60'}`}
        aria-label="Character count"
      >
        {charCount}/{TWEET_MAX_CHARS}
      </span>
    </div>
  );
}
