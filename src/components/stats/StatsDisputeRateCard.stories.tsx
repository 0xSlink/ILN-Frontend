import type { Meta, StoryObj } from '@storybook/react-vite';
import StatsDisputeRateCard from './StatsDisputeRateCard';
import type { DisputeRateMetrics } from '@/utils/dispute-rate';

const mockMetrics: DisputeRateMetrics = {
  rate30dPercent: 3.5,
  disputed30d: 35,
  funded30d: 1000,
  dailyTrend90d: Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
    label: `${90 - i}d`,
    fundedCount: Math.floor(Math.random() * 20) + 5,
    disputedCount: Math.floor(Math.random() * 2),
    ratePercent: Math.random() * 8,
  })),
};

const meta: Meta<typeof StatsDisputeRateCard> = {
  title: 'Components/Stats/StatsDisputeRateCard',
  component: StatsDisputeRateCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    metrics: mockMetrics,
  },
};

export const ZeroRate: Story = {
  args: {
    metrics: { ...mockMetrics, rate30dPercent: 0, disputed30d: 0 },
  },
};

export const HighRate: Story = {
  args: {
    metrics: { ...mockMetrics, rate30dPercent: 12.8, disputed30d: 128 },
  },
};
