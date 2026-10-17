import type { Meta, StoryObj } from '@storybook/react-vite';
import StatsMetricCards from './StatsMetricCards';
import type { ContractStats } from '@/utils/contract-stats';

const mockStats: ContractStats = {
  total_invoices: 1247,
  total_funded: 892,
  total_paid: 756,
  total_volume_usd: 2400000,
  total_protocol_fees_usd: 12500,
  feeRateBps: 0,
};

const meta: Meta<typeof StatsMetricCards> = {
  title: 'Components/Stats/StatsMetricCards',
  component: StatsMetricCards,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    stats: mockStats,
  },
};

export const ZeroStats: Story = {
  args: {
    stats: {
      total_invoices: 0,
      total_funded: 0,
      total_paid: 0,
      total_volume_usd: 0,
      total_protocol_fees_usd: 0,
      feeRateBps: 0,
    },
  },
};
