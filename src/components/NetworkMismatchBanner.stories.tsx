import type { Meta, StoryObj } from '@storybook/react-vite';
import NetworkMismatchBanner from './NetworkMismatchBanner';

const meta = {
  title: 'Components/NetworkMismatchBanner',
  component: NetworkMismatchBanner,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof NetworkMismatchBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state - showing network mismatch warning
 * Displays error message and network switch action
 */
export const Default: Story = {};

/**
 * With error details
 * Shows specific network information
 */
export const WithDetails: Story = {};

/**
 * Compact mode - reduced height for integration into existing layouts
 */
export const Compact: Story = {};
