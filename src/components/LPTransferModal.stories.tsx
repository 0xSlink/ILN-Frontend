import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import LPTransferModal from './LPTransferModal';

const meta: Meta<typeof LPTransferModal> = {
  title: 'Components/LPTransferModal',
  component: LPTransferModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockInvoice = {
  id: 42n,
  amount: 1000000000n,
  status: 'Funded',
} as any;

export const Default: Story = {
  args: {
    invoice: mockInvoice,
    onClose: () => {},
    onSuccess: fn((invoice, newOwner) => `Transferred to: ${newOwner}`),
  },
};
