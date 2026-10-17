import type { Meta, StoryObj } from '@storybook/react-vite';
import BulkActionBar from './BulkActionBar';

const meta: Meta<typeof BulkActionBar> = {
  title: 'Components/BulkActionBar',
  component: BulkActionBar,
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
    status: 'Pending',
    payer: 'GABC...',
    freelancer: 'GDEF...',
    discount_rate: 300,
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400),
    token: 'USDC',
  },
] as any[];

export const WithSelection: Story = {
  args: {
    selectedInvoices: mockInvoices,
    onClearSelection: () => {},
    onRefresh: () => {},
  },
};

export const Empty: Story = {
  args: {
    selectedInvoices: [],
    onClearSelection: () => {},
    onRefresh: () => {},
  },
};
