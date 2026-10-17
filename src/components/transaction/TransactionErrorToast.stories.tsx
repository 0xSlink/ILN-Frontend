import type { Meta, StoryObj } from '@storybook/react-vite';
import { TransactionErrorToast } from './TransactionErrorToast';

const meta: Meta<typeof TransactionErrorToast> = {
  title: 'Components/Transaction/TransactionErrorToast',
  component: TransactionErrorToast,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    message: { control: 'text' },
    remediation: { control: 'text' },
    technicalDetails: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    message: 'The transaction could not be completed.',
  },
};

export const WithRemediation: Story = {
  args: {
    message: 'Insufficient balance.',
    remediation: 'Please add more funds to your wallet and try again.',
  },
};

export const Full: Story = {
  args: {
    message: 'Transaction failed due to network congestion.',
    remediation: 'Please wait a few minutes and try again.',
    technicalDetails:
      'Error: tx_too_late\nCode: -32000\nDetails: The transaction deadline has passed.',
  },
};
