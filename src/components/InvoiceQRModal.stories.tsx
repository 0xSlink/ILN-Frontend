import type { Meta, StoryObj } from '@storybook/react-vite';
import InvoiceQRModal from './InvoiceQRModal';

const meta: Meta<typeof InvoiceQRModal> = {
  title: 'Components/InvoiceQRModal',
  component: InvoiceQRModal,
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
    amount: 1000000000n,
    dueDate: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
    freelancer: 'GABC12345678901234567890123456789012345678901234567890123456',
    baseUrl: 'https://app.iln.example.com',
    onClose: () => {},
  },
};
