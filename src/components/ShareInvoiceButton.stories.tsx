import type { Meta, StoryObj } from '@storybook/react-vite';
import ShareInvoiceButton from './ShareInvoiceButton';

const meta: Meta<typeof ShareInvoiceButton> = {
  title: 'Components/ShareInvoiceButton',
  component: ShareInvoiceButton,
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
  status: 'Pending',
  payer: 'GPAY1234567890123456789012345678901234567890123456789012345678',
  freelancer: 'GABC12345678901234567890123456789012345678901234567890123456',
  discount_rate: 300,
  due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
  token: 'USDC',
} as any;

export const Default: Story = {
  args: {
    invoice: mockInvoice,
  },
};
