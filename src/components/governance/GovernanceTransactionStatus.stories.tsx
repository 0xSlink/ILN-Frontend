import type { Meta, StoryObj } from '@storybook/react-vite';
import GovernanceTransactionStatus from './GovernanceTransactionStatus';

const meta: Meta<typeof GovernanceTransactionStatus> = {
  title: 'Governance/GovernanceTransactionStatus',
  component: GovernanceTransactionStatus,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    state: {
      control: 'select',
      options: ['pending', 'success', 'failure', 'timeout', 'cancelled'],
    },
    txHash: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE_HASH = '3f9a1c7e0b2d4e6f8a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d9e1f2a4b6c8d0e2f';

export const Pending: Story = {
  args: { state: 'pending', txHash: SAMPLE_HASH },
};

export const Success: Story = {
  args: { state: 'success', txHash: SAMPLE_HASH },
};

export const Failure: Story = {
  args: { state: 'failure', txHash: SAMPLE_HASH, onRetry: () => {} },
};

export const Timeout: Story = {
  args: { state: 'timeout', txHash: SAMPLE_HASH, onRetry: () => {} },
};

export const Cancelled: Story = {
  args: { state: 'cancelled' },
};
