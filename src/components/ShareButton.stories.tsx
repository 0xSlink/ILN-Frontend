import type { Meta, StoryObj } from '@storybook/react-vite';
import ShareButton from './ShareButton';

const meta: Meta<typeof ShareButton> = {
  title: 'Components/ShareButton',
  component: ShareButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockInvoice = {
  id: 42n,
  amount: 1000000000n,
  status: 'Paid',
  payer: 'GPAY1234567890123456789012345678901234567890123456789012345678',
  freelancer: 'GABC12345678901234567890123456789012345678901234567890123456',
  funder: 'GLP12345678901234567890123456789012345678901234567890123456789',
  discount_rate: 300,
  due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
  funded_at: BigInt(Math.floor(Date.now() / 1000) - 86400 * 10),
  token: 'USDC',
} as any;

export const AsFreelancer: Story = {
  args: {
    invoice: mockInvoice,
    userAddress: 'GABC12345678901234567890123456789012345678901234567890123456',
  },
};

export const AsLP: Story = {
  args: {
    invoice: mockInvoice,
    userAddress: 'GLP12345678901234567890123456789012345678901234567890123456789',
  },
};

export const NotPaid: Story = {
  args: {
    invoice: { ...mockInvoice, status: 'Funded' },
    userAddress: 'GABC12345678901234567890123456789012345678901234567890123456',
  },
};
