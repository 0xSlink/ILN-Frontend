import type { Meta, StoryObj } from '@storybook/react-vite';
import StatsTokenBreakdown from './StatsTokenBreakdown';
import type { TokenVolume } from '@/utils/contract-stats';

const mockTokens: TokenVolume[] = [
  { symbol: 'USDC', amount_raw: 1500000, amount_usd: 1500000, percentage: 60, color: '#008080' },
  { symbol: 'EURC', amount_raw: 500000, amount_usd: 540000, percentage: 25, color: '#2e7d32' },
  { symbol: 'XLM', amount_raw: 2000000, amount_usd: 240000, percentage: 15, color: '#d32f2f' },
];

const meta: Meta<typeof StatsTokenBreakdown> = {
  title: 'Components/Stats/StatsTokenBreakdown',
  component: StatsTokenBreakdown,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tokens: mockTokens,
    totalUsd: 2280000,
  },
};

export const Empty: Story = {
  args: {
    tokens: [],
    totalUsd: 0,
  },
};

export const SingleToken: Story = {
  args: {
    tokens: [
      { symbol: 'USDC', amount_raw: 500000, amount_usd: 500000, percentage: 100, color: '#008080' },
    ],
    totalUsd: 500000,
  },
};
