import type { Meta, StoryObj } from '@storybook/react-vite';
import LPTokenMetricsCards from './LPTokenMetricsCards';

const meta: Meta<typeof LPTokenMetricsCards> = {
  title: 'Components/LPTokenMetricsCards',
  component: LPTokenMetricsCards,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockMetrics = [
  {
    token: { contractId: 'usdc', symbol: 'USDC', decimals: 7, iconLabel: 'U', isAllowed: true },
    invoiceCount: 5,
    paidCount: 3,
    totalFunded: 5000000000n,
    totalYieldEarned: 150000000n,
    pendingYield: 50000000n,
    yieldPercentage: 3.0,
  },
] as any;

export const Default: Story = {
  args: {
    metrics: mockMetrics,
    showUSDEquivalent: false,
    onToggleUSD: () => {},
  },
};

export const ShowUSD: Story = {
  args: {
    metrics: mockMetrics,
    showUSDEquivalent: true,
    onToggleUSD: () => {},
  },
};

export const Empty: Story = {
  args: {
    metrics: [],
    showUSDEquivalent: false,
    onToggleUSD: () => {},
  },
};
