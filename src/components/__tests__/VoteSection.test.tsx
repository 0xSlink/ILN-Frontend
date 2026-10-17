import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VoteSection from '../VoteSection';
import type { Proposal } from '@/utils/governance';

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 5,
    title: 'Adjust protocol fee',
    description: 'Lower the protocol fee from 2% to 1.5%.',
    type: 'ParameterChange',
    status: 'Active',
    proposer: 'GPROPOSER',
    createdAt: 0,
    votingStartsAt: 0,
    votingEndsAt: 0,
    votesFor: 100,
    votesAgainst: 20,
    quorumRequired: 1000,
    ...overrides,
  } as Proposal;
}

// VoteButton's accessible name includes its icon glyph text (e.g. "thumb_upFor"),
// so role-based name queries can't target it by the visible label alone. Its
// distinguishing class (`active:scale-95`) is unique to VoteButton among the
// dialog's buttons, so scope on that instead.
function getVoteButton(choice: string): HTMLElement {
  const match = screen
    .getAllByRole('button')
    .find((btn) => btn.className.includes('active:scale-95') && btn.textContent?.includes(choice));
  if (!match) throw new Error(`Vote button "${choice}" not found`);
  return match;
}

const baseProps = {
  proposal: proposal(),
  isConnected: true,
  alreadyVoted: false,
  onVote: vi.fn(),
  voteLoading: false,
  canVote: true,
  connect: vi.fn(),
  votingPower: 50,
};

describe('VoteSection', () => {
  it('prompts wallet connection when disconnected', () => {
    const connect = vi.fn();
    render(<VoteSection {...baseProps} isConnected={false} connect={connect} />);

    expect(screen.getByText('Connect your wallet to cast a vote.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Connect wallet to vote'));
    expect(connect).toHaveBeenCalled();
  });

  it('shows a message when the wallet has no voting power', () => {
    render(<VoteSection {...baseProps} votingPower={0} />);
    expect(screen.getByText('You need ILN tokens to vote.')).toBeInTheDocument();
  });

  it('shows a message when voting has ended', () => {
    render(<VoteSection {...baseProps} proposal={proposal({ status: 'Passed' })} />);
    expect(screen.getByText('Voting has ended for this proposal.')).toBeInTheDocument();
  });

  it('shows quorum not reached when total votes are below the requirement', () => {
    render(<VoteSection {...baseProps} />);
    expect(screen.getAllByText(/Quorum not yet reached/).length).toBeGreaterThan(0);
  });

  it('shows quorum reached when total votes meet the requirement', () => {
    render(
      <VoteSection {...baseProps} proposal={proposal({ votesFor: 800, votesAgainst: 250 })} />
    );
    expect(screen.getAllByText(/^Quorum reached/).length).toBeGreaterThan(0);
  });

  it('opens a confirmation dialog and casts the vote on confirm', () => {
    const onVote = vi.fn();
    render(<VoteSection {...baseProps} onVote={onVote} />);

    fireEvent.click(getVoteButton('For'));
    expect(screen.getByRole('heading', { name: 'Confirm Vote' })).toBeInTheDocument();
    expect(screen.getByText('#5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Vote' }));
    expect(onVote).toHaveBeenCalledWith('For');
    expect(screen.queryByText('This action cannot be undone.')).not.toBeInTheDocument();
  });

  it('cancels the confirmation dialog without voting', () => {
    const onVote = vi.fn();
    render(<VoteSection {...baseProps} onVote={onVote} />);

    fireEvent.click(getVoteButton('Against'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onVote).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Confirm Vote' })).not.toBeInTheDocument();
  });

  it('confirms the pending vote on Enter and dismisses it on Escape', () => {
    const onVote = vi.fn();
    render(<VoteSection {...baseProps} onVote={onVote} />);

    fireEvent.click(getVoteButton('Against'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: 'Confirm Vote' })).not.toBeInTheDocument();
    expect(onVote).not.toHaveBeenCalled();

    fireEvent.click(getVoteButton('Against'));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onVote).toHaveBeenCalledWith('Against');
    expect(screen.queryByRole('heading', { name: 'Confirm Vote' })).not.toBeInTheDocument();
  });

  it('shows the recorded vote and disables all choices once already voted', () => {
    render(<VoteSection {...baseProps} alreadyVoted userVote="For" />);

    expect(screen.getByText('Your vote has been recorded.')).toBeInTheDocument();
    expect(getVoteButton('For')).toBeDisabled();
    expect(getVoteButton('Against')).toBeDisabled();
  });

  it('shows a loading label on unselected buttons while voting is in flight', () => {
    render(<VoteSection {...baseProps} voteLoading canVote={false} />);

    const votingButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('active:scale-95'));
    expect(votingButtons.length).toBe(2);
    expect(votingButtons[0]).toBeDisabled();
  });
});
