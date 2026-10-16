'use client';

import { useState, useEffect } from 'react';
import { Proposal, VoteChoice } from '@/utils/governance';
import QuorumProgressBar from './QuorumProgressBar';
import VoteProgressBar from './VoteProgressBar';
import GovernanceMockStatusBanner from './governance/GovernanceMockStatusBanner';

interface VoteSectionProps {
  proposal: Proposal;
  isConnected: boolean;
  alreadyVoted: boolean;
  userVote?: VoteChoice;
  onVote: (choice: VoteChoice) => void;
  voteLoading: boolean;
  canVote: boolean;
  connect: () => void;
  votingPower: number;
}

const VOTE_STYLES: Record<VoteChoice, { base: string; active: string; icon: string }> = {
  For: {
    base: 'border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10',
    active: 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20',
    icon: 'thumb_up',
  },
  Against: {
    base: 'border-red-500/40 text-red-500 hover:bg-red-500/10',
    active: 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20',
    icon: 'thumb_down',
  },
  Abstain: {
    base: 'border-outline text-on-surface-variant hover:bg-surface-container-high',
    active: 'bg-outline text-white border-outline shadow-lg',
    icon: 'do_not_disturb',
  },
};

function VoteButton({
  choice,
  selected,
  disabled,
  loading,
  onClick,
}: {
  choice: VoteChoice;
  selected: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const s = VOTE_STYLES[choice];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 font-semibold text-sm transition-all duration-200 active:scale-95
        ${selected ? s.active : s.base}
        ${disabled && !selected ? 'opacity-40 cursor-not-allowed' : ''}
      `}
    >
      <span
        className="material-symbols-outlined text-[20px]"
        style={selected ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {s.icon}
      </span>
      {loading && !selected ? 'Voting…' : choice}
    </button>
  );
}

export default function VoteSection({
  proposal,
  isConnected,
  alreadyVoted,
  userVote,
  onVote,
  voteLoading,
  canVote,
  connect,
  votingPower,
}: VoteSectionProps) {
  const total = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
  const quorumReached = total >= proposal.quorumRequired;
  const voteDisabled = !canVote || voteLoading;

  const [pendingVote, setPendingVote] = useState<VoteChoice | null>(null);

  useEffect(() => {
    if (!pendingVote) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingVote(null);
      } else if (e.key === 'Enter') {
        onVote(pendingVote);
        setPendingVote(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingVote, onVote]);

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 space-y-6">
      <GovernanceMockStatusBanner action="castVote" />

      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold">Vote</h2>
            <p className="text-xs text-on-surface-variant">
              Cast your vote or review current results.
            </p>
          </div>
          <span
            className={`text-xs font-semibold uppercase tracking-[0.22em] ${proposal.status === 'Active' ? 'text-emerald-500' : 'text-on-surface-variant'}`}
          >
            {proposal.status}
          </span>
        </div>

        <div className="mb-5">
          <p className="text-sm font-semibold text-on-surface-variant">
            {total.toLocaleString()} ILN total ·{' '}
            {quorumReached ? 'Quorum reached' : 'Quorum not yet reached'}
          </p>
        </div>

        <QuorumProgressBar
          votesCast={total}
          quorumRequired={proposal.quorumRequired}
          className="mb-5"
        />

        <VoteProgressBar
          votesFor={proposal.votesFor}
          votesAgainst={proposal.votesAgainst}
          votesAbstain={proposal.votesAbstain}
          quorumRequired={proposal.quorumRequired}
        />
      </div>

      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container p-5 space-y-4">
        {!isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">Connect your wallet to cast a vote.</p>
            <button
              type="button"
              onClick={connect}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
            >
              Connect wallet to vote
            </button>
          </div>
        ) : votingPower === 0 ? (
          <p className="text-sm text-on-surface-variant">You need ILN tokens to vote.</p>
        ) : proposal.status !== 'Active' ? (
          <p className="text-sm text-on-surface-variant">Voting has ended for this proposal.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              {alreadyVoted ? 'Your vote has been recorded.' : 'Select a stance below to vote.'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['For', 'Against', 'Abstain'] as VoteChoice[]).map((choice) => (
                <VoteButton
                  key={choice}
                  choice={choice}
                  selected={alreadyVoted && userVote === choice}
                  disabled={alreadyVoted || voteDisabled}
                  loading={voteLoading}
                  onClick={() => setPendingVote(choice)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {pendingVote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-2xl">
            <h3 className="mb-4 text-xl font-bold">Confirm Vote</h3>
            <div className="mb-6 space-y-4">
              <p className="text-sm text-on-surface-variant">
                You are about to cast your vote for proposal <strong>#{proposal.id}</strong>.
              </p>
              <div className="rounded-xl bg-surface-container p-4">
                <span className="text-sm text-on-surface-variant">Your selection:</span>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {VOTE_STYLES[pendingVote].icon}
                  </span>
                  <span
                    className={`font-bold ${pendingVote === 'For' ? 'text-emerald-500' : pendingVote === 'Against' ? 'text-red-500' : 'text-on-surface-variant'}`}
                  >
                    {pendingVote}
                  </span>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPendingVote(null)}
                className="flex-1 rounded-xl border border-outline-variant py-3 text-sm font-bold hover:bg-surface-variant/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onVote(pendingVote);
                  setPendingVote(null);
                }}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90"
              >
                Confirm Vote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
