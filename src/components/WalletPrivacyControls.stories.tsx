import type { Meta, StoryObj } from '@storybook/react-vite';
import { WalletPrivacyControls } from './WalletPrivacyControls';

/**
 * Visual-regression stories (#1156) locking the wallet storage + disconnect
 * controls across responsive viewports and dark mode. The component is pure and
 * prop-driven, so these snapshots are deterministic and need no wallet context.
 */

const meta = {
  title: 'Components/WalletPrivacyControls',
  component: WalletPrivacyControls,
  parameters: {
    layout: 'centered',
    // Deterministic snapshot: no async work, no clipboard timing.
    chromatic: { delay: 0 },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        style={{
          width: '240px',
          borderRadius: '12px',
          border: '1px solid rgba(0, 0, 0, 0.12)',
          padding: '8px',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WalletPrivacyControls>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Light mode, desktop viewport — the baseline for the privacy controls. */
export const Default: Story = {
  args: {
    address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6',
    onDisconnect: () => {},
    onCopy: async () => {},
  },
};

/** Dark mode — locks the disconnect + copy controls on the dark theme. */
export const DarkMode: Story = {
  args: {
    address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6',
    onDisconnect: () => {},
    onCopy: async () => {},
  },
  globals: { theme: 'dark' },
};

/** Mobile viewport (375px) — locks the responsive layout. */
export const Mobile: Story = {
  args: {
    address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6',
    onDisconnect: () => {},
    onCopy: async () => {},
  },
  parameters: {
    chromatic: { viewports: [375] },
  },
};

/** Mobile viewport in dark mode — combined responsive + dark lock. */
export const MobileDark: Story = {
  args: {
    address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6',
    onDisconnect: () => {},
    onCopy: async () => {},
  },
  parameters: {
    chromatic: { viewports: [375] },
  },
  globals: { theme: 'dark' },
};
