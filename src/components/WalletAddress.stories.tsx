import type { Meta, StoryObj } from '@storybook/react-vite';
import WalletAddress from './WalletAddress';

/**
 * WalletAddress renders a Stellar G-address, optionally resolving it to a
 * human-readable Federation address (e.g. "alice*example.com").
 *
 * Because federation resolution is async and hits the network, the stories
 * below use a `truncate` override to render deterministic display values
 * without any network calls, keeping Chromatic snapshots stable.
 */

const SAMPLE_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const SHORT_ADDRESS = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBVN';

const meta: Meta<typeof WalletAddress> = {
  title: 'Components/WalletAddress',
  component: WalletAddress,
  parameters: {
    layout: 'centered',
    chromatic: { delay: 100 },
  },
  tags: ['autodocs'],
  argTypes: {
    hideCopy: { control: { type: 'boolean' } },
    className: { control: { type: 'text' } },
  },
  // Provide a stable truncate fn so stories don't depend on async resolution
  args: {
    address: SAMPLE_ADDRESS,
    truncate: (addr: string) => addr.slice(0, 6) + '...' + addr.slice(-4),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: truncated G-address with copy button */
export const Default: Story = {};

/** Copy button hidden */
export const HideCopy: Story = {
  args: { hideCopy: true },
};

/** Simulates a resolved Federation address by passing it directly as the address */
export const FederatedAddress: Story = {
  args: {
    address: 'alice*example.com',
    truncate: (addr: string) => addr, // federation addresses are shown as-is
  },
};

/** Empty address — renders nothing */
export const Empty: Story = {
  args: { address: '' },
};

/** Custom className applied to the outer span */
export const CustomClass: Story = {
  args: {
    address: SHORT_ADDRESS,
    className: 'text-primary font-bold text-sm',
  },
};

/** Multiple addresses side-by-side (as seen in invoice tables) */
export const InlineList: Story = {
  render: () => (
    <div className="flex flex-col gap-2 font-mono text-sm">
      <WalletAddress
        address={SAMPLE_ADDRESS}
        truncate={(a) => a.slice(0, 6) + '...' + a.slice(-4)}
      />
      <WalletAddress
        address={SHORT_ADDRESS}
        truncate={(a) => a.slice(0, 6) + '...' + a.slice(-4)}
        hideCopy
      />
      <WalletAddress address="alice*example.com" truncate={(a) => a} />
    </div>
  ),
};
