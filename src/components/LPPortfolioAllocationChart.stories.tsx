import type { Meta, StoryObj } from '@storybook/react-vite';
import LPPortfolioAllocationChart from './LPPortfolioAllocationChart';

const meta: Meta<typeof LPPortfolioAllocationChart> = {
  title: 'Components/LPPortfolioAllocationChart',
  component: LPPortfolioAllocationChart,
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
  },
};

export const Empty: Story = {
  args: {
    metrics: [],
  },
};
