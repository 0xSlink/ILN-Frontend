import type { Meta, StoryObj } from '@storybook/react-vite';
import InvoiceTimeline from './InvoiceTimeline';

const meta: Meta<typeof InvoiceTimeline> = {
  title: 'Components/InvoiceTimeline',
  component: InvoiceTimeline,
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
    status: 'Paid',
    payer: 'GABC12345678901234567890123456789012345678901234567890123456',
    freelancer: 'GDEF4567890123456789012345678901234567890123456789012345678',
    discount_rate: 300,
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
    funded_at: BigInt(Math.floor(Date.now() / 1000) - 86400),
    token: 'USDC',
  },
  {
    id: 2n,
    amount: 2500000000n,
    status: 'Funded',
    payer: 'GXYZ98765432109876543210987654321098765432109876543210987654321',
    freelancer: 'GDEF4567890123456789012345678901234567890123456789012345678',
    discount_rate: 400,
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 60),
    funded_at: BigInt(Math.floor(Date.now() / 1000) - 3600),
    token: 'USDC',
  },
] as any;

export const Default: Story = {
  args: {
    invoices: mockInvoices,
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    invoices: [],
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    invoices: [],
    loading: false,
  },
};
