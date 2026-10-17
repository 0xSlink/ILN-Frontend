import type { Meta, StoryObj } from '@storybook/react-vite';
import Toast from './Toast';

const meta: Meta<typeof Toast> = {
  title: 'Components/Toast',
  component: Toast,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClose: { action: 'closed' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    toast: {
      type: 'success',
      title: 'Transaction confirmed',
      message: 'Your invoice has been submitted successfully.',
    },
    onClose: () => {},
  },
};

export const Pending: Story = {
  args: {
    toast: {
      type: 'pending',
      title: 'Processing',
      message: 'Waiting for wallet signature...',
    },
    onClose: () => {},
  },
};

export const Error: Story = {
  args: {
    toast: {
      type: 'error',
      title: 'Transaction failed',
      message: 'Insufficient balance for this transaction.',
    },
    onClose: () => {},
  },
};

export const WithTxHash: Story = {
  args: {
    toast: {
      type: 'success',
      title: 'Invoice submitted',
      message: 'Invoice is now live on testnet.',
      txHash: 'a1b2c3d4e5f6...',
    },
    onClose: () => {},
  },
};

export const WithAction: Story = {
  args: {
    toast: {
      type: 'success',
      title: 'Invoice submitted',
      message: 'Invoice is now live.',
      action: { label: 'View Invoice', onClick: () => {} },
    },
    onClose: () => {},
  },
};
