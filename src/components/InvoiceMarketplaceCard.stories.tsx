import type { Meta, StoryObj } from '@storybook/react-vite';
const fn = () => () => {};
import InvoiceMarketplaceCard from './InvoiceMarketplaceCard';

const USDC_TOKEN_ID = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';

const baseInvoice = {
  id: BigInt(42),
  status: 'Pending',
  freelancer: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  payer: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBVN',
  amount: BigInt(125_000_000),
  due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
  discount_rate: 250,
  token: USDC_TOKEN_ID,
};

const tokenMap = new Map([
  [USDC_TOKEN_ID, { contractId: USDC_TOKEN_ID, name: 'USD Coin', symbol: 'USDC', decimals: 6 }],
]);

const defaultToken = { contractId: USDC_TOKEN_ID, name: 'USD Coin', symbol: 'USDC', decimals: 6 };

const meta: Meta<typeof InvoiceMarketplaceCard> = {
  title: 'Components/InvoiceMarketplaceCard',
  component: InvoiceMarketplaceCard,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'light',
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 400 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    invoice: baseInvoice,
    tokenMap,
    defaultToken,
    payerScore: { score: 85, settled_on_time: 14, defaults: 1 },
    payerRisk: 'Low',
    onFund: fn(),
    isWalletConnected: true,
    minReputation: 0,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WalletDisconnected: Story = {
  args: {
    isWalletConnected: false,
  },
};

export const HighRiskPayer: Story = {
  args: {
    payerScore: { score: 20, settled_on_time: 2, defaults: 8 },
    payerRisk: 'High',
  },
};

export const LowReputationFiltered: Story = {
  name: 'Below Reputation Threshold',
  args: {
    payerScore: { score: 40, settled_on_time: 5, defaults: 3 },
    payerRisk: 'Medium',
    minReputation: 70,
  },
};

export const OracleVerified: Story = {
  args: {
    payerOracleVerified: true,
    payerRisk: 'Low',
  },
};

export const LargeInvoice: Story = {
  args: {
    invoice: {
      ...baseInvoice,
      amount: BigInt(10_000_000_000),
      discount_rate: 500,
    },
  },
};

export const ShortDueDate: Story = {
  args: {
    invoice: {
      ...baseInvoice,
      due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 3),
    },
  },
};

export const NoPayerScore: Story = {
  args: {
    payerScore: null,
    payerRisk: 'Unknown',
  },
};
