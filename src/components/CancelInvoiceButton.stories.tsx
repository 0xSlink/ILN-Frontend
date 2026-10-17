import type { Meta, StoryObj } from '@storybook/react-vite';
import CancelInvoiceButton from './CancelInvoiceButton';

const meta: Meta<typeof CancelInvoiceButton> = {
  title: 'Components/CancelInvoiceButton',
  component: CancelInvoiceButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    compact: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockInvoice = {
  id: 42n,
  amount: 1000000000n,
  status: 'Pending',
  payer: 'GABC12345678901234567890123456789012345678901234567890123456',
  freelancer: 'GXXX12345678901234567890123456789012345678901234567890123456',
  discount_rate: 300,
  due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
  token: 'USDC',
} as any;

export const Default: Story = {
  args: {
    invoice: mockInvoice,
    walletAddress: 'GXXX12345678901234567890123456789012345678901234567890123456',
  },
};

export const Compact: Story = {
  args: {
    invoice: mockInvoice,
    walletAddress: 'GXXX12345678901234567890123456789012345678901234567890123456',
    compact: true,
  },
};

export const NotOwner: Story = {
  args: {
    invoice: mockInvoice,
    walletAddress: null,
  },
};
