import type { Meta, StoryObj } from '@storybook/react-vite';
import InvoiceNftCard from './InvoiceNftCard';

const meta: Meta<typeof InvoiceNftCard> = {
  title: 'Components/InvoiceNftCard',
  component: InvoiceNftCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    invoiceId: 42n,
    invoiceStatus: 'Funded',
    walletAddress: 'GABC12345678901234567890123456789012345678901234567890123456',
  },
};

// ── Dark-feature visual regression baselines (Closes #41) ────────────────────
//
// The stories below capture the Invoice NFT Card UI with the feature flag
// FORCED ON so that Chromatic can establish visual baselines for the enabled
// state across the meaningful sub-states (loading, loaded, error, no-data).
//
// Tagged `dark-feature` for selective targeting in the visual regression
// workflow. The `env` parameter override forces the component to render
// regardless of the build-time NEXT_PUBLIC_NFT_ENABLED value.

const flagEnabledBase = {
  env: { NEXT_PUBLIC_NFT_ENABLED: 'true' },
  chromatic: {
    modes: {
      light: { backgrounds: { value: '#ffffff' } },
      dark: { backgrounds: { value: '#1a1a1a' } },
    },
  },
};

/**
 * Invoice NFT Card — flag enabled, standard funded invoice.
 * Primary visual baseline for the enabled state (Chromatic).
 */
export const FlagEnabled: Story = {
  tags: ['dark-feature', 'chromatic'],
  args: {
    invoiceId: 42n,
    invoiceStatus: 'Funded',
    walletAddress: 'GABC12345678901234567890123456789012345678901234567890123456',
  },
  parameters: flagEnabledBase,
};

/**
 * Invoice NFT Card — flag enabled, invoice owned by a different funder.
 * Captures the funder address display variant.
 */
export const FlagEnabledWithFunder: Story = {
  tags: ['dark-feature', 'chromatic'],
  args: {
    invoiceId: 99n,
    invoiceStatus: 'Funded',
    walletAddress: 'GABC12345678901234567890123456789012345678901234567890123456',
    invoiceFunder: 'GFND12345678901234567890123456789012345678901234567890123456',
  },
  parameters: flagEnabledBase,
};

/**
 * Invoice NFT Card — flag enabled, loading skeleton state.
 * Baseline for the async loading appearance; animations paused for consistency.
 */
export const FlagEnabledLoading: Story = {
  tags: ['dark-feature', 'chromatic'],
  args: {
    invoiceId: 1n,
    invoiceStatus: 'Pending',
    walletAddress: null,
  },
  parameters: {
    ...flagEnabledBase,
    chromatic: {
      ...flagEnabledBase.chromatic,
      // Freeze at end of animation so the skeleton renders at a stable frame.
      pauseAnimationAtEnd: true,
    },
  },
};

/**
 * Invoice NFT Card — flag enabled, no wallet connected (null address).
 * Covers the disconnected-wallet display variant.
 */
export const FlagEnabledNoWallet: Story = {
  tags: ['dark-feature', 'chromatic'],
  args: {
    invoiceId: 7n,
    invoiceStatus: 'Funded',
    walletAddress: null,
  },
  parameters: flagEnabledBase,
};
