'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchParameterUpdates,
  fetchProposals,
  fetchVotesForAddress,
  type ParameterUpdateEvent,
  type Proposal,
  type VoteCastEvent,
} from '@/utils/governance';
import { formatDate } from '@/utils/format';
import Skeleton from '@/components/ui/Skeleton';

const PAGE_SIZE = 10;

type ActivityType = 'all' | 'votes' | 'proposals' | 'parameters';

type FeedItem =
  | { kind: 'vote'; timestamp: number; data: VoteCastEvent }
  | { kind: 'proposal'; timestamp: number; data: Proposal }
  | { kind: 'parameter'; timestamp: number; data: ParameterUpdateEvent };

interface GovernanceActivityProps {
  address: string;
}

const FILTERS: Array<{ value: ActivityType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'votes', label: 'Votes' },
  { value: 'proposals', label: 'Proposals' },
  { value: 'parameters', label: 'Parameters' },
];

function getActivityLabel(item: FeedItem) {
  if (item.kind === 'vote') {
    return `Voted ${item.data.vote.toLowerCase()} on ${item.data.proposalTitle}`;
  }
  if (item.kind === 'proposal') {
    return `Proposal created: ${item.data.title}`;
  }
  return `Parameter update: ${item.data.label}`;
}

export default function GovernanceActivity({ address }: GovernanceActivityProps) {
  const [votes, setVotes] = useState<VoteCastEvent[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [parameterUpdates, setParameterUpdates] = useState<ParameterUpdateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ActivityType>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function loadActivity() {
      setLoading(true);
      try {
        const [voteData, proposalData, parameterData] = await Promise.all([
          fetchVotesForAddress(address),
          fetchProposals(),
          fetchParameterUpdates(),
        ]);
        setVotes(voteData);
        setProposals(proposalData);
        setParameterUpdates(parameterData);
      } catch (err) {
        console.error('Failed to fetch governance activity:', err);
      } finally {
        setLoading(false);
      }
    }
    loadActivity();
  }, [address]);

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...votes.map((vote) => ({ kind: 'vote' as const, timestamp: vote.timestamp, data: vote })),
      ...proposals.map((proposal) => ({
        kind: 'proposal' as const,
        timestamp: proposal.createdAt,
        data: proposal,
      })),
      ...parameterUpdates.map((update) => ({
        kind: 'parameter' as const,
        timestamp: update.updatedAt,
        data: update,
      })),
    ];

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [parameterUpdates, proposals, votes]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return feedItems;
    return feedItems.filter((item) => item.kind === activeFilter.slice(0, -1));
  }, [activeFilter, feedItems]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredItems, page]
  );

  useEffect(() => {
    setPage(1);
  }, [activeFilter]);

  if (loading) {
    return (
      <section className="rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-on-surface">Governance Activity</h2>
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-4 border-b border-outline-variant/5"
            >
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <section className="rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-on-surface">Governance Activity</h2>
        <div className="mt-6 rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container/30 p-8 text-center text-on-surface-variant">
          <p className="text-base font-medium">No governance activity yet.</p>
          <p className="mt-2 text-sm">Try a different filter or come back later.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold text-on-surface">Governance Activity</h2>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Activity filters">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === filter.value
                  ? 'bg-primary text-surface-container-lowest'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
              aria-pressed={activeFilter === filter.value}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-3" aria-label="Governance activity feed">
        {pageItems.map((item) => {
          const isExpanded = Boolean(expandedIds[`${item.kind}-${item.timestamp}`]);
          const detailsId = `${item.kind}-${item.timestamp}`;

          return (
            <li
              key={detailsId}
              className="rounded-2xl border border-outline-variant/10 bg-surface-container/30 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-on-surface">{getActivityLabel(item)}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {' '}
                    {formatDate(BigInt(item.timestamp))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant">
                    {item.kind === 'vote'
                      ? 'Vote'
                      : item.kind === 'proposal'
                        ? 'Proposal'
                        : 'Parameter'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedIds((current) => ({
                        ...current,
                        [detailsId]: !current[detailsId],
                      }))
                    }
                    className="text-sm font-medium text-primary"
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? 'Less' : 'More'}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {pageCount > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-outline-variant/20 p-2 disabled:opacity-30 hover:bg-surface-container"
            aria-label="Previous page"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <span className="text-xs font-semibold text-on-surface-variant">
            Page {page} of {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page === pageCount}
            className="rounded-lg border border-outline-variant/20 p-2 disabled:opacity-30 hover:bg-surface-container"
            aria-label="Next page"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      )}
    </section>
  );
}
