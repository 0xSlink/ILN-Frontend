import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import PayerSettlementModal from './PayerSettlementModal';

const meta: Meta<typeof PayerSettlementModal> = {
  title: 'Components/PayerSettlementModal',
  component: PayerSettlementModal,
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
  status: 'Funded',
  payer: 'GPAY1234567890123456789012345678901234567890123456789012345678',
  freelancer: 'GDEF4567890123456789012345678901234567890123456789012345678',
  discount_rate: 300,
  due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
  token: 'USDC',
  funder: 'GLP12345678901234567890123456789012345678901234567890123456789',
} as any;

const mockToken = {
  contractId: 'usdc',
  symbol: 'USDC',
  decimals: 7,
  name: 'USD Coin',
} as any;

export const Default: Story = {
  args: {
    invoice: mockInvoice,
    token: mockToken,
    isOpen: true,
    onClose: () => {},
    onConfirm: fn(async (amount) => `Settle: ${amount.toString()}`),
    submitting: false,
  },
};

export const Closed: Story = {
  args: {
    invoice: mockInvoice,
    token: mockToken,
    isOpen: false,
    onClose: () => {},
    onConfirm: async () => {},
    submitting: false,
  },
};
