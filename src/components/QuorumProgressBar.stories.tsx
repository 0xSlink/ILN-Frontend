import type { Meta, StoryObj } from '@storybook/react-vite';
import QuorumProgressBar from './QuorumProgressBar';

const meta: Meta<typeof QuorumProgressBar> = {
  title: 'Components/QuorumProgressBar',
  component: QuorumProgressBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    votesCast: { control: 'number' },
    quorumRequired: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const BelowQuorum: Story = {
  args: {
    votesCast: 5000,
    quorumRequired: 10000,
  },
};

export const MetQuorum: Story = {
  args: {
    votesCast: 12000,
    quorumRequired: 10000,
  },
};

export const Halfway: Story = {
  args: {
    votesCast: 500000,
    quorumRequired: 1000000,
  },
};
