import type { Meta, StoryObj } from '@storybook/react-vite';
import WeeklyYieldChart from './WeeklyYieldChart';
import type { TokenYieldMetrics } from '@/utils/per-token-yield';

const mockMetrics: TokenYieldMetrics[] = [
  {
    token: {
      contractId: 'usdc-1',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 7,
      iconLabel: 'USDC',
    },
    totalYield: 10000000n,
  },
  {
    token: {
      contractId: 'eurc-1',
      symbol: 'EURC',
      name: 'Euro Coin',
      decimals: 7,
      iconLabel: 'EURC',
    },
    totalYield: 5000000n,
  },
];

const meta: Meta<typeof WeeklyYieldChart> = {
  title: 'Components/WeeklyYieldChart',
  component: WeeklyYieldChart,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    showUSDEquivalent: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    invoices: [],
    metrics: mockMetrics,
    showUSDEquivalent: false,
  },
};

export const Empty: Story = {
  args: {
    invoices: [],
    metrics: [],
    showUSDEquivalent: false,
  },
};
