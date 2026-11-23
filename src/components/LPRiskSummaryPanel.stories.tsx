import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import LPRiskSummaryPanel from './LPRiskSummaryPanel';
import type { Invoice } from '@/utils/soroban';

// Production bundle isolation guard: story fixtures must never be loaded or evaluated
// in production client bundles outside the Storybook environment.
if (
  typeof process !== 'undefined' &&
  process.env?.NODE_ENV === 'production' &&
  !process.env?.STORYBOOK
) {
  throw new Error(
    'CRITICAL: LPRiskSummaryPanel.stories must not be imported in production builds.'
  );
}

/**
 * SYNTHETIC STORYBOOK FIXTURES — NOT LIVE PROTOCOL DATA.
 *
 * These fixtures are strictly for Storybook visual UI demonstration and isolation testing.
 * They use synthetic IDs (999_990_001n+) and synthetic mock account addresses so they can
 * never be mistaken for live Stellar/Soroban ledger data or submitted to contracts.
 */
const SYNTHETIC_MOCK_PAYER = 'GMOCK_STORY_FIXTURE_PAYER_NOT_LIVE_ACCOUNT_0001';
const SYNTHETIC_MOCK_FREELANCER = 'GMOCK_STORY_FIXTURE_FREELANCER_NOT_LIVE_0001';
const SYNTHETIC_MOCK_FUNDER = 'GMOCK_STORY_FIXTURE_FUNDER_NOT_LIVE_0001';

const mockInvoices: Invoice[] = [
  {
    id: 999_990_001n, // Synthetic fixture ID
    amount: 1_000_000_000n, // 100 USDC (7 decimals)
    status: 'Funded',
    due_date: BigInt(Math.floor(Date.now() / 1000) + 3600), // Expiring soon (<24h)
    token: 'USDC',
    payer: SYNTHETIC_MOCK_PAYER,
    freelancer: SYNTHETIC_MOCK_FREELANCER,
    funder: SYNTHETIC_MOCK_FUNDER,
    discount_rate: 300,
  },
  {
    id: 999_990_002n, // Synthetic fixture ID
    amount: 5_000_000_000n, // 500 USDC
    status: 'Disputed',
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
    token: 'USDC',
    payer: SYNTHETIC_MOCK_PAYER,
    freelancer: SYNTHETIC_MOCK_FREELANCER,
    funder: SYNTHETIC_MOCK_FUNDER,
    discount_rate: 300,
  },
  {
    id: 999_990_003n, // Synthetic fixture ID
    amount: 2_000_000_000n, // 200 USDC
    status: 'Funded',
    due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 60),
    token: 'USDC',
    payer: SYNTHETIC_MOCK_PAYER,
    freelancer: SYNTHETIC_MOCK_FREELANCER,
    funder: SYNTHETIC_MOCK_FUNDER,
    discount_rate: 300,
  },
];

const meta: Meta<typeof LPRiskSummaryPanel> = {
  title: 'Components/LPRiskSummaryPanel',
  component: LPRiskSummaryPanel,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'LP Risk Summary Panel displays portfolio exposure risk. All data rendered in these stories uses synthetic mock fixtures that are isolated from production and must never be mistaken for live protocol data.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRisk: Story = {
  args: {
    invoices: mockInvoices,
    onFilterByRisk: fn((filter) => `Filter: ${filter}`),
    // Story fixtures demonstrate the verified-data state; no live query runs here.
    dataUpdatedAt: Date.now(),
  },
};

export const NoPositions: Story = {
  args: {
    invoices: [],
    onFilterByRisk: () => {},
  },
};
