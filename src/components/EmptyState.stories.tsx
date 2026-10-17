import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'wallet-disconnected',
        'no-invoices',
        'no-funded-positions',
        'empty-marketplace',
        'no-governance-proposals',
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WalletDisconnected: Story = {
  args: {
    variant: 'wallet-disconnected',
  },
};

export const NoInvoices: Story = {
  args: {
    variant: 'no-invoices',
    action: {
      label: 'Create Invoice',
      onClick: () => {},
    },
  },
};

export const NoFundedPositions: Story = {
  args: {
    variant: 'no-funded-positions',
    action: {
      label: 'Browse Marketplace',
      onClick: () => {},
    },
  },
};

export const EmptyMarketplace: Story = {
  args: {
    variant: 'empty-marketplace',
    action: {
      label: 'Refresh',
      onClick: () => {},
    },
  },
};

export const NoGovernanceProposals: Story = {
  args: {
    variant: 'no-governance-proposals',
  },
};

export const WithActionButton: Story = {
  name: 'With Action Button (generic)',
  args: {
    variant: 'no-invoices',
    action: {
      label: 'Get Started',
      onClick: () => alert('Action clicked'),
    },
  },
};
