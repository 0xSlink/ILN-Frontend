import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GovernanceActivity from '@/components/GovernanceActivity';
import { fetchParameterUpdates, fetchProposals, fetchVotesForAddress } from '@/utils/governance';

vi.mock('@/utils/governance', () => ({
  fetchVotesForAddress: vi.fn(),
  fetchProposals: vi.fn(),
  fetchParameterUpdates: vi.fn(),
}));

const mockFetchVotesForAddress = vi.mocked(fetchVotesForAddress);
const mockFetchProposals = vi.mocked(fetchProposals);
const mockFetchParameterUpdates = vi.mocked(fetchParameterUpdates);

describe('GovernanceActivity Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a helpful empty state when no activity exists', async () => {
    mockFetchVotesForAddress.mockResolvedValue([]);
    mockFetchProposals.mockResolvedValue([]);
    mockFetchParameterUpdates.mockResolvedValue([]);

    render(<GovernanceActivity address="GABC" />);

    expect(await screen.findByText(/No governance activity yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Try a different filter or come back later/i)).toBeInTheDocument();
  });

  it('renders mixed governance activity entries in chronological order', async () => {
    mockFetchVotesForAddress.mockResolvedValue([
      {
        proposalId: 2,
        proposalTitle: 'Vote on quorum',
        voter: 'GABC',
        vote: 'For' as const,
        weight: 1250,
        timestamp: 1_700_000_000,
      },
    ]);
    mockFetchProposals.mockResolvedValue([
      {
        id: 3,
        title: 'Proposal created',
        description: 'A new proposal',
        type: 'TextProposal',
        status: 'Active',
        proposer: 'GXYZ',
        createdAt: 1_701_000_000,
        votingStartsAt: 1_701_000_000,
        votingEndsAt: 1_702_000_000,
        votesFor: 0,
        votesAgainst: 0,
        votesAbstain: 0,
        quorumRequired: 0,
      },
    ]);
    mockFetchParameterUpdates.mockResolvedValue([
      {
        id: '4:fee',
        proposalId: 4,
        parameter: 'fee_rate_bps',
        label: 'Fee rate',
        newValue: '30',
        updatedAt: 1_702_000_000,
      },
    ]);

    render(<GovernanceActivity address="GABC" />);

    const items = await screen.findAllByRole('listitem');
    expect(items[0]).toHaveTextContent(/Parameter update/i);
    expect(items[1]).toHaveTextContent(/Proposal created/i);
    expect(items[2]).toHaveTextContent(/Voted/i);
  });

  it('filters the feed by activity type and expands details on demand', async () => {
    mockFetchVotesForAddress.mockResolvedValue([
      {
        proposalId: 2,
        proposalTitle: 'Vote on quorum',
        voter: 'GABC',
        vote: 'For' as const,
        weight: 1250,
        timestamp: 1_700_000_000,
      },
    ]);
    mockFetchProposals.mockResolvedValue([
      {
        id: 3,
        title: 'Proposal created',
        description: 'A new proposal',
        type: 'TextProposal',
        status: 'Active',
        proposer: 'GXYZ',
        createdAt: 1_701_000_000,
        votingStartsAt: 1_701_000_000,
        votingEndsAt: 1_702_000_000,
        votesFor: 0,
        votesAgainst: 0,
        votesAbstain: 0,
        quorumRequired: 0,
      },
    ]);
    mockFetchParameterUpdates.mockResolvedValue([]);

    render(<GovernanceActivity address="GABC" />);

    expect(await screen.findByText(/Proposal created/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Votes/i }));

    expect(screen.getByText(/Voted/i)).toBeInTheDocument();
    expect(screen.queryByText(/Proposal created/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByText(/Vote on quorum/i)).toBeInTheDocument();
  });
});
