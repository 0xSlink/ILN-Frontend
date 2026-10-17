import type { Meta, StoryObj } from '@storybook/react-vite';
import LPPortfolio from './LPPortfolio';

const meta: Meta<typeof LPPortfolio> = {
  title: 'Components/LPPortfolio',
  component: LPPortfolio,
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
    funder: 'GXXX12345678901234567890123456789012345678901234567890123456',
    discount_rate: 300,
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
    token: 'USDC',
  },
] as any;

export const Default: Story = {
  args: {
    invoices: mockInvoices,
    isLoading: false,
    onClaimDefault: async () => {},
    claimingInvoiceId: null,
  },
};

export const Loading: Story = {
  args: {
    invoices: [],
    isLoading: true,
    onClaimDefault: async () => {},
    claimingInvoiceId: null,
  },
};

export const Empty: Story = {
  args: {
    invoices: [],
    isLoading: false,
    onClaimDefault: async () => {},
    claimingInvoiceId: null,
  },
};
