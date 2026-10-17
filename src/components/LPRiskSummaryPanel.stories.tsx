import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import LPRiskSummaryPanel from './LPRiskSummaryPanel';

const meta: Meta<typeof LPRiskSummaryPanel> = {
  title: 'Components/LPRiskSummaryPanel',
  component: LPRiskSummaryPanel,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockInvoices = [
  {
    id: 1n,
    amount: 1000000000n,
    status: 'Funded',
    due_date: BigInt(Math.floor(Date.now() / 1000) + 3600), // expiring soon
    token: 'USDC',
  },
  {
    id: 2n,
    amount: 5000000000n,
    status: 'Disputed',
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
    token: 'USDC',
  },
  {
    id: 3n,
    amount: 2000000000n,
    status: 'Funded',
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 60),
    token: 'USDC',
  },
] as any;

export const WithRisk: Story = {
  args: {
    invoices: mockInvoices,
    onFilterByRisk: fn((filter) => `Filter: ${filter}`),
  },
};

export const NoPositions: Story = {
  args: {
    invoices: [],
    onFilterByRisk: () => {},
  },
};
