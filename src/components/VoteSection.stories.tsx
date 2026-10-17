import type { Meta, StoryObj } from '@storybook/react-vite';
import VoteSection from './VoteSection';
import type { Proposal, VoteChoice } from '@/utils/governance';

const mockProposal: Proposal = {
  id: '1',
  title: 'Increase ILN Supply Cap',
  description: 'Proposal to increase the maximum supply cap of ILN tokens by 10%.',
  status: 'Active',
  votesFor: 1500000,
  votesAgainst: 500000,
  quorumRequired: 3000000,
  endTime: BigInt(Math.floor(Date.now() / 1000) + 86400 * 7),
  proposer: 'GABCDEF123...',
};

const meta: Meta<typeof VoteSection> = {
  title: 'Components/VoteSection',
  component: VoteSection,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onVote: { action: 'voted' },
    connect: { action: 'connect' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ConnectedCanVote: Story = {
  args: {
    proposal: mockProposal,
    isConnected: true,
    alreadyVoted: false,
    onVote: () => {},
    voteLoading: false,
    canVote: true,
    connect: () => {},
    votingPower: 50000,
  },
};

export const AlreadyVoted: Story = {
  args: {
    proposal: mockProposal,
    isConnected: true,
    alreadyVoted: true,
    userVote: 'For' as VoteChoice,
    onVote: () => {},
    voteLoading: false,
    canVote: false,
    connect: () => {},
    votingPower: 50000,
  },
};

export const NotConnected: Story = {
  args: {
    proposal: mockProposal,
    isConnected: false,
    alreadyVoted: false,
    onVote: () => {},
    voteLoading: false,
    canVote: false,
    connect: () => {},
    votingPower: 0,
  },
};

export const NoVotingPower: Story = {
  args: {
    proposal: mockProposal,
    isConnected: true,
    alreadyVoted: false,
    onVote: () => {},
    voteLoading: false,
    canVote: false,
    connect: () => {},
    votingPower: 0,
  },
};

export const Ended: Story = {
  args: {
    proposal: { ...mockProposal, status: 'Executed' },
    isConnected: true,
    alreadyVoted: true,
    userVote: 'Against' as VoteChoice,
    onVote: () => {},
    voteLoading: false,
    canVote: false,
    connect: () => {},
    votingPower: 50000,
  },
};
