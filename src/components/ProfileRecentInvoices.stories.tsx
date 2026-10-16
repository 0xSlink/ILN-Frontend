import type { Meta, StoryObj } from '@storybook/react-vite';
import ProfileRecentInvoices from './ProfileRecentInvoices';

const meta: Meta<typeof ProfileRecentInvoices> = {
  title: 'Components/ProfileRecentInvoices',
  component: ProfileRecentInvoices,
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
    payer: 'GPAY1234567890123456789012345678901234567890123456789012345678',
    freelancer: 'GABC12345678901234567890123456789012345678901234567890123456',
    discount_rate: 300,
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
    funded_at: BigInt(Math.floor(Date.now() / 1000) - 86400 * 5),
    token: 'USDC',
  },
  {
    id: 2n,
    amount: 2500000000n,
    status: 'Funded',
    payer: 'GPAY1234567890123456789012345678901234567890123456789012345678',
    freelancer: 'GABC12345678901234567890123456789012345678901234567890123456',
    discount_rate: 400,
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 60),
    token: 'USDC',
  },
] as any;

export const Default: Story = {
  args: {
    invoices: mockInvoices,
    address: 'GABC12345678901234567890123456789012345678901234567890123456',
  },
};

export const Empty: Story = {
  args: {
    invoices: [],
    address: 'GABC12345678901234567890123456789012345678901234567890123456',
  },
};
