import type { Meta, StoryObj } from '@storybook/react-vite';
import LPEarningsHistory from './LPEarningsHistory';

const meta: Meta<typeof LPEarningsHistory> = {
  title: 'Components/LPEarningsHistory',
  component: LPEarningsHistory,
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
    funder: 'GXXX12345678901234567890123456789012345678901234567890123456',
    discount_rate: 300,
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
    funded_at: BigInt(Math.floor(Date.now() / 1000) - 86400 * 10),
    token: 'USDC',
  },
] as any;

export const WithData: Story = {
  args: {
    invoices: mockInvoices,
    tokenMap: new Map(),
    defaultToken: null,
    walletAddress: 'GXXX12345678901234567890123456789012345678901234567890123456',
  },
};

export const NoWallet: Story = {
  args: {
    invoices: [],
    tokenMap: new Map(),
    defaultToken: null,
    walletAddress: null,
  },
};

export const Empty: Story = {
  args: {
    invoices: [],
    tokenMap: new Map(),
    defaultToken: null,
    walletAddress: 'GXXX12345678901234567890123456789012345678901234567890123456',
  },
};
