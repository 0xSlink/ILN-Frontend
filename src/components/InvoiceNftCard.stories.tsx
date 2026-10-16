import type { Meta, StoryObj } from '@storybook/react-vite';
import InvoiceNftCard from './InvoiceNftCard';

const meta: Meta<typeof InvoiceNftCard> = {
  title: 'Components/InvoiceNftCard',
  component: InvoiceNftCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    invoiceId: 42n,
    invoiceStatus: 'Funded',
    walletAddress: 'GABC12345678901234567890123456789012345678901234567890123456',
  },
};
