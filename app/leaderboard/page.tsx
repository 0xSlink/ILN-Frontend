'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';
import { formatAddress, formatUSDC } from '@/utils/format';
import {
  getTopPayers,
  getTopFreelancers,
  getTopLPs,
  TopPayer,
  TopFreelancer,
  TopLP,
  LeaderboardTab,
} from '@/utils/soroban';
import { resolveFederatedAddress } from '@/utils/federation';
import { NETWORK_NAME } from '@/constants';

const DEFAULT_LEADERBOARD_LIMIT = 50;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const ITEMS_PER_PAGE = 20;

function getStellarExpertProfileUrl(address: string) {
  const networkPath = NETWORK_NAME.toUpperCase() === 'TESTNET' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${networkPath}/account/${address}`;
}

function getDisplayAddress(name: string, address: string) {
  return name && name !== address ? name : formatAddress(address);
}

export default function LeaderboardPage() {
  const { address: connectedAddress } = useWallet();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('payers');
  const [payers, setPayers] = useState<TopPayer[]>([]);
  const [freelancers, setFreelancers] = useState<TopFreelancer[]>([]);
  const [lps, setLps] = useState<TopLP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [federatedNames, setFederatedNames] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [previousRanks, setPreviousRanks] = useState<Record<string, number>>({});
  const currentUrl = useRef<string>('');

  const highlightAddress = useMemo(() => connectedAddress?.toLowerCase() ?? '', [connectedAddress]);

  const isUserRow = (address: string) =>
    connectedAddress !== null && address.toLowerCase() === highlightAddress;

  const currentData = useMemo(() => {
    const data = activeTab === 'payers' ? payers : activeTab === 'freelancers' ? freelancers : lps;
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(
      (item) =>
        item.address.toLowerCase().includes(query) ||
        federatedNames[item.address]?.toLowerCase().includes(query)
    );
  }, [activeTab, payers, freelancers, lps, searchQuery, federatedNames]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentData, currentPage]);

  const totalPages = Math.ceil(currentData.length / ITEMS_PER_PAGE);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      currentUrl.current = window.location.href;
    }
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const [topPayers, topFreelancers, topLPs] = await Promise.all([
        getTopPayers(DEFAULT_LEADERBOARD_LIMIT),
        getTopFreelancers(DEFAULT_LEADERBOARD_LIMIT),
        getTopLPs(DEFAULT_LEADERBOARD_LIMIT),
      ]);

      setPreviousRanks((_prev) => {
        const newRanks: Record<string, number> = {};
        topPayers.forEach((p, i) => (newRanks[`payer-${p.address}`] = i + 1));
        topFreelancers.forEach((f, i) => (newRanks[`freelancer-${f.address}`] = i + 1));
        topLPs.forEach((l, i) => (newRanks[`lp-${l.address}`] = i + 1));
        return newRanks;
      });

      setPayers(topPayers);
      setFreelancers(topFreelancers);
      setLps(topLPs);
    } catch (err) {
      setError('Unable to load leaderboard data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
    const intervalId = window.setInterval(loadLeaderboard, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  useEffect(() => {
    let active = true;
    const allAddresses = [
      ...payers.map((p) => p.address),
      ...freelancers.map((f) => f.address),
      ...lps.map((l) => l.address),
    ];
    const uniqueAddresses = Array.from(new Set(allAddresses));

    const resolveFederationNames = async () => {
      const resolved: Record<string, string> = {};
      await Promise.all(
        uniqueAddresses.map(async (address) => {
          if (federatedNames[address]) return;
          const name = await resolveFederatedAddress(address);
          if (!active) return;
          if (name && name !== address) {
            resolved[address] = name;
          }
        })
      );
      if (active && Object.keys(resolved).length > 0) {
        setFederatedNames((current) => ({ ...current, ...resolved }));
      }
    };

    if (uniqueAddresses.length > 0) {
      void resolveFederationNames();
    }

    return () => {
      active = false;
    };
  }, [payers, freelancers, lps, federatedNames]);

  const handleShare = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(currentUrl.current || '/leaderboard');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard failures
    }
  };

  const getRankChange = (address: string, currentRank: number) => {
    const key = `${activeTab}-${address}`;
    const prevRank = previousRanks[key];
    if (prevRank === undefined) return null;
    if (prevRank === currentRank) return null;
    return prevRank - currentRank;
  };

  const getRankChangeIcon = (change: number | null) => {
    if (change === null) return null;
    if (change > 0) return <span className="text-green-500 text-xs">↑ {change}</span>;
    if (change < 0) return <span className="text-red-500 text-xs">↓ {Math.abs(change)}</span>;
    return null;
  };

  const renderTableHeaders = () => {
    if (activeTab === 'payers') {
      return (
        <>
          <th className="px-5 py-4">Rank</th>
          <th className="px-5 py-4">Address</th>
          <th className="px-5 py-4">Score</th>
          <th className="px-5 py-4">Invoices Paid</th>
          <th className="px-5 py-4">Invoices Defaulted</th>
          <th className="px-5 py-4">Total Volume</th>
          <th className="px-5 py-4">Profile</th>
        </>
      );
    } else if (activeTab === 'freelancers') {
      return (
        <>
          <th className="px-5 py-4">Rank</th>
          <th className="px-5 py-4">Address</th>
          <th className="px-5 py-4">Score</th>
          <th className="px-5 py-4">Invoices Submitted</th>
          <th className="px-5 py-4">Invoices Funded</th>
          <th className="px-5 py-4">Total Earned</th>
          <th className="px-5 py-4">Profile</th>
        </>
      );
    } else {
      return (
        <>
          <th className="px-5 py-4">Rank</th>
          <th className="px-5 py-4">Address</th>
          <th className="px-5 py-4">Score</th>
          <th className="px-5 py-4">Liquidity Provided</th>
          <th className="px-5 py-4">Fees Earned</th>
          <th className="px-5 py-4">Total Funded</th>
          <th className="px-5 py-4">Profile</th>
        </>
      );
    }
  };

  const renderTableRow = (item: TopPayer | TopFreelancer | TopLP, index: number) => {
    const isUser = isUserRow(item.address);
    const displayName = getDisplayAddress(federatedNames[item.address] ?? '', item.address);
    const globalRank = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
    const rankChange = getRankChange(item.address, globalRank);

    return (
      <tr
        key={item.address}
        data-testid={isUser ? 'leaderboard-user-row' : undefined}
        className={`border-t border-outline-variant/20 transition-colors ${isUser ? 'bg-primary/10' : 'bg-transparent hover:bg-surface-container-low'}`}
      >
        <td className="px-5 py-4 font-semibold text-on-surface-variant">
          <div className="flex items-center gap-2">
            #{globalRank}
            {getRankChangeIcon(rankChange)}
          </div>
        </td>
        <td className="px-5 py-4">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{displayName}</span>
            <span className="text-xs text-on-surface-variant/80">
              {formatAddress(item.address)}
            </span>
            {isUser ? (
              <span className="text-[11px] font-semibold uppercase text-primary">Your wallet</span>
            ) : null}
          </div>
        </td>
        <td className="px-5 py-4 font-semibold">{item.score.toLocaleString()}</td>
        {activeTab === 'payers' && (
          <>
            <td className="px-5 py-4">{(item as TopPayer).invoices_paid.toLocaleString()}</td>
            <td className="px-5 py-4">{(item as TopPayer).invoices_defaulted.toLocaleString()}</td>
            <td className="px-5 py-4">{formatUSDC((item as TopPayer).total_volume)}</td>
          </>
        )}
        {activeTab === 'freelancers' && (
          <>
            <td className="px-5 py-4">
              {(item as TopFreelancer).invoices_submitted.toLocaleString()}
            </td>
            <td className="px-5 py-4">
              {(item as TopFreelancer).invoices_funded.toLocaleString()}
            </td>
            <td className="px-5 py-4">{formatUSDC((item as TopFreelancer).total_earned)}</td>
          </>
        )}
        {activeTab === 'lps' && (
          <>
            <td className="px-5 py-4">{formatUSDC((item as TopLP).liquidity_provided)}</td>
            <td className="px-5 py-4">{formatUSDC((item as TopLP).fees_earned)}</td>
            <td className="px-5 py-4">{(item as TopLP).total_funded.toLocaleString()}</td>
          </>
        )}
        <td className="px-5 py-4">
          <div className="flex flex-col gap-1">
            <Link
              href={`/profile/${item.address}`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              View Profile
            </Link>
            <a
              href={getStellarExpertProfileUrl(item.address)}
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs text-on-surface-variant hover:underline"
            >
              Stellar Expert
            </a>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-on-surface-variant mb-2">
            Leaderboard
          </p>
          <h1 className="text-3xl font-semibold">
            {activeTab === 'payers'
              ? 'Top Payers'
              : activeTab === 'freelancers'
                ? 'Top Freelancers'
                : 'Top Liquidity Providers'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
            {activeTab === 'payers'
              ? 'Find the most reliable payers by reputation, invoices paid, defaults and settled volume.'
              : activeTab === 'freelancers'
                ? 'Discover top freelancers by reputation, invoices submitted, funded and total earnings.'
                : 'View leading liquidity providers by contribution, fees earned and funding activity.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center justify-center rounded-2xl border border-outline-variant/70 bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high"
        >
          {copied ? 'Link copied' : 'Share Leaderboard'}
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {(['payers', 'freelancers', 'lps'] as LeaderboardTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {tab === 'payers' ? 'Payers' : tab === 'freelancers' ? 'Freelancers' : 'LPs'}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Search by address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-full sm:w-64"
        />
      </div>

      <div className="overflow-x-auto rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-1">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-surface dark:bg-surface-container-highest text-on-surface-variant text-xs uppercase tracking-[0.16em]">
              {renderTableHeaders()}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-on-surface-variant">
                  Loading leaderboard…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-error">
                  {error}
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-on-surface-variant">
                  {searchQuery ? 'No results found.' : `No ${activeTab} found.`}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => renderTableRow(item, index))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-lg border border-outline-variant/30 bg-surface-container-low text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-container-high"
          >
            Previous
          </button>
          <span className="text-sm text-on-surface-variant">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-lg border border-outline-variant/30 bg-surface-container-low text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-container-high"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
