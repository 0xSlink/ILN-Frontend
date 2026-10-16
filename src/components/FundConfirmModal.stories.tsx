import type { Meta, StoryObj } from '@storybook/react-vite';
import FundConfirmModal from './FundConfirmModal';

const meta: Meta<typeof FundConfirmModal> = {
  title: 'Components/FundConfirmModal',
  component: FundConfirmModal,
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
  payer: 'GABC12345678901234567890123456789012345678901234567890123456',
  freelancer: 'GDEF4567890123456789012345678901234567890123456789012345678',
  discount_rate: 300,
  due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
  token: 'USDC',
} as any;

export const Default: Story = {
  args: {
    invoice: mockInvoice,
    onClose: () => {},
    onSuccess: () => {},
    payerScore: { score: 85, totalFunded: 10, totalDefaulted: 0, lastActivity: Date.now() },
  },
};

export const NoPayerScore: Story = {
  args: {
    invoice: mockInvoice,
    onClose: () => {},
    onSuccess: () => {},
  },
};
