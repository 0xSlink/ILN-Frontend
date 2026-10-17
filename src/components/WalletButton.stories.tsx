import type { Meta, StoryObj } from '@storybook/react-vite';
import WalletButton from './WalletButton';

// This component requires WalletContext provider
// Stories demonstrate the different visual states

const meta = {
  title: 'Components/WalletButton',
  component: WalletButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof WalletButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state - wallet not connected
 * Displays the "Connect Wallet" button
 */
export const Disconnected: Story = {};

/**
 * Loading state - attempting to reconnect
 * Button is disabled and shows "Reconnecting..." text
 */
export const Reconnecting: Story = {};

/**
 * Error state - wallet connection failed
 * Shows error message below the button
 */
export const ConnectionError: Story = {};

/**
 * Network mismatch - wallet connected to wrong network
 * Shows network status indicator in red
 */
export const NetworkMismatch: Story = {};

/**
 * Wallet not installed - Freighter extension missing
 * Shows install link below button
 */
export const WalletNotInstalled: Story = {};

/**
 * Connected state - wallet successfully connected
 * Shows wallet address, balances, and network status
 */
export const Connected: Story = {};

/**
 * Connected with dropdown open
 * Shows copy address and disconnect options
 */
export const ConnectedDropdownOpen: Story = {};

/**
 * Loading balances - freshly connected, fetching token balances
 * Shows "Loading balances..." text
 */
export const LoadingBalances: Story = {};

/**
 * Unavailable trustline - one or more token balances require trustline setup
 * Shows "Add Trustline" button for affected tokens
 */
export const UnavailableTrustline: Story = {};
