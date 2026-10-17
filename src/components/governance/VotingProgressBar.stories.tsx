import type { Meta, StoryObj } from '@storybook/react-vite';
import VotingProgressBar from './VotingProgressBar';

const meta: Meta<typeof VotingProgressBar> = {
  title: 'Components/Governance/VotingProgressBar',
  component: VotingProgressBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    for: { control: 'number' },
    against: { control: 'number' },
    quorum: { control: 'number' },
    totalEligible: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    for: 1500000,
    against: 500000,
    quorum: 3000000,
    totalEligible: 10000000,
  },
};

export const QuorumReached: Story = {
  args: {
    for: 3500000,
    against: 800000,
    quorum: 3000000,
    totalEligible: 10000000,
  },
};

export const Unanimous: Story = {
  args: {
    for: 5000000,
    against: 0,
    quorum: 3000000,
    totalEligible: 10000000,
  },
};
