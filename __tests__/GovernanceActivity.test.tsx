import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GovernanceActivity from '@/components/GovernanceActivity';
import {
  fetchParameterUpdates,
  fetchProposals,
  fetchSignerRotations,
  fetchVotesForAddress,
} from '@/utils/governance';

vi.mock('@/utils/governance', () => ({
  fetchVotesForAddress: vi.fn(),
  fetchProposals: vi.fn(),
  fetchParameterUpdates: vi.fn(),
  fetchSignerRotations: vi.fn(),
}));

const mockFetchVotesForAddress = vi.mocked(fetchVotesForAddress);
const mockFetchProposals = vi.mocked(fetchProposals);
const mockFetchParameterUpdates = vi.mocked(fetchParameterUpdates);
const mockFetchSignerRotations = vi.mocked(fetchSignerRotations);

describe('GovernanceActivity Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a helpful empty state when no activity exists', async () => {
    mockFetchVotesForAddress.mockResolvedValue([]);
    mockFetchProposals.mockResolvedValue([]);
    mockFetchParameterUpdates.mockResolvedValue([]);
    mockFetchSignerRotations.mockResolvedValue([]);

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
    mockFetchSignerRotations.mockResolvedValue([]);

    render(<GovernanceActivity address="GABC" />);

    const items = await screen.findAllByRole('listitem');
    expect(items[0]).toHaveTextContent(/Parameter update/i);
    expect(items[1]).toHaveTextContent(/Proposal created/i);
    expect(items[2]).toHaveTextContent(/Voted/i);
  });

  it('renders SignerRotated events with distinct security labeling and details', async () => {
    mockFetchVotesForAddress.mockResolvedValue([]);
    mockFetchProposals.mockResolvedValue([]);
    mockFetchParameterUpdates.mockResolvedValue([
      {
        id: '1:fee',
        proposalId: 1,
        parameter: 'fee_rate_bps',
        label: 'Fee rate',
        newValue: '30',
        updatedAt: 1_700_000_000,
      },
    ]);
    mockFetchSignerRotations.mockResolvedValue([
      {
        id: 'sr-1',
        txHash: '0x1234567890abcdef',
        oldSigner: 'GCOEF7LMN456OPQ789RST012UVW345XYZ678ABC901DEF234GHI567JKL',
        newSigner: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        rotatedAt: 1_703_000_000,
        reason: 'Quarterly key rotation',
        action: 'rotated',
        securityLevel: 'critical',
      },
    ]);

    render(<GovernanceActivity address="GABC" />);

    expect(await screen.findByText(/Multisig Signer Rotated/i)).toBeInTheDocument();
    expect(screen.getByText(/Security Critical/i)).toBeInTheDocument();
    expect(screen.getByText(/Parameter update/i)).toBeInTheDocument();

    // Expand signer rotation details
    const moreButtons = screen.getAllByRole('button', { name: 'More' });
    fireEvent.click(moreButtons[0]);

    expect(screen.getByText(/Previous Signer:/i)).toBeInTheDocument();
    expect(screen.getByText(/New Signer:/i)).toBeInTheDocument();
    expect(screen.getByText(/Quarterly key rotation/i)).toBeInTheDocument();
    expect(screen.getByText(/Security Notice: Signer rotation/i)).toBeInTheDocument();
  });

  it('filters the feed by Signer Rotations tab', async () => {
    mockFetchVotesForAddress.mockResolvedValue([]);
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
        quorumRequired: 0,
      },
    ]);
    mockFetchParameterUpdates.mockResolvedValue([]);
    mockFetchSignerRotations.mockResolvedValue([
      {
        id: 'sr-1',
        txHash: '0x1234',
        oldSigner: 'GCOEF7',
        newSigner: 'GAAAAA',
        rotatedAt: 1_703_000_000,
        reason: 'Key rotation',
        action: 'rotated',
      },
    ]);

    render(<GovernanceActivity address="GABC" />);

    expect(await screen.findByText(/Proposal created/i)).toBeInTheDocument();
    expect(screen.getByText(/Multisig Signer Rotated/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Signer Rotations/i }));

    expect(screen.getByText(/Multisig Signer Rotated/i)).toBeInTheDocument();
    expect(screen.queryByText(/Proposal created/i)).not.toBeInTheDocument();
  });
});
