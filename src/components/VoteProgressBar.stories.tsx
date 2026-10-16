import type { Meta, StoryObj } from '@storybook/react-vite';
import VoteProgressBar from './VoteProgressBar';

const meta: Meta<typeof VoteProgressBar> = {
  title: 'Components/VoteProgressBar',
  component: VoteProgressBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    votesFor: { control: 'number' },
    votesAgainst: { control: 'number' },
    votesAbstain: { control: 'number' },
    quorumRequired: { control: 'number' },
    compact: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    votesFor: 1500000,
    votesAgainst: 500000,
    votesAbstain: 100000,
    quorumRequired: 3000000,
  },
};

export const QuorumReached: Story = {
  args: {
    votesFor: 2500000,
    votesAgainst: 800000,
    votesAbstain: 200000,
    quorumRequired: 3000000,
  },
};

export const Compact: Story = {
  args: {
    votesFor: 1500000,
    votesAgainst: 500000,
    votesAbstain: 100000,
    quorumRequired: 3000000,
    compact: true,
  },
};

export const Landslide: Story = {
  args: {
    votesFor: 8000000,
    votesAgainst: 200000,
    votesAbstain: 50000,
    quorumRequired: 3000000,
  },
};
