import type { Meta, StoryObj } from '@storybook/react-vite';
import LPWhitelistManager from './LPWhitelistManager';

const meta: Meta<typeof LPWhitelistManager> = {
  title: 'Components/Invoices/LPWhitelistManager',
  component: LPWhitelistManager,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    invoiceId: { control: 'text' },
    submitterAddress: { control: 'text' },
    currentWallet: { control: 'text' },
    status: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    invoiceId: '42',
    submitterAddress: 'GABCDEF123456789',
    currentWallet: 'GABCDEF123456789',
    status: 'Pending',
    whitelist: ['GA123456789012345', 'GB987654321098765'],
  },
};

export const Empty: Story = {
  args: {
    invoiceId: '42',
    submitterAddress: 'GABCDEF123456789',
    currentWallet: 'GABCDEF123456789',
    status: 'Pending',
    whitelist: [],
  },
};

export const NotSubmitter: Story = {
  args: {
    invoiceId: '42',
    submitterAddress: 'GABCDEF123456789',
    currentWallet: 'GOTHERWALLET12345',
    status: 'Pending',
    whitelist: [],
  },
};

export const AlreadyFunded: Story = {
  args: {
    invoiceId: '42',
    submitterAddress: 'GABCDEF123456789',
    currentWallet: 'GABCDEF123456789',
    status: 'Funded',
    whitelist: ['GA123456789012345'],
  },
};
