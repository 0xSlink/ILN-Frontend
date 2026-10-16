import type { Meta, StoryObj } from '@storybook/react-vite';
import MarkPaidButton from './MarkPaidButton';

const meta: Meta<typeof MarkPaidButton> = {
  title: 'Components/MarkPaidButton',
  component: MarkPaidButton,
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
  status: 'Funded',
  payer: 'GPAY1234567890123456789012345678901234567890123456789012345678',
  freelancer: 'GDEF4567890123456789012345678901234567890123456789012345678',
  discount_rate: 300,
  due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
  token: 'USDC',
} as any;

export const Default: Story = {
  args: {
    invoice: mockInvoice,
    walletAddress: 'GPAY1234567890123456789012345678901234567890123456789012345678',
  },
};

export const Compact: Story = {
  args: {
    invoice: mockInvoice,
    walletAddress: 'GPAY1234567890123456789012345678901234567890123456789012345678',
    compact: true,
  },
};

export const NotPayer: Story = {
  args: {
    invoice: mockInvoice,
    walletAddress: 'GWRONG1234567890123456789012345678901234567890123456789012345',
  },
};
