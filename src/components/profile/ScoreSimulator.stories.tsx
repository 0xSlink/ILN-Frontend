import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScoreSimulator } from './ScoreSimulator';

const meta: Meta<typeof ScoreSimulator> = {
  title: 'Components/Profile/ScoreSimulator',
  component: ScoreSimulator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    currentPaid: { control: 'number' },
    currentSubmitted: { control: 'number' },
    currentDefaulted: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    currentPaid: 80,
    currentSubmitted: 100,
    currentDefaulted: 5,
  },
};

export const PerfectScore: Story = {
  args: {
    currentPaid: 100,
    currentSubmitted: 100,
    currentDefaulted: 0,
  },
};

export const PoorScore: Story = {
  args: {
    currentPaid: 30,
    currentSubmitted: 100,
    currentDefaulted: 40,
  },
};
