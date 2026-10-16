import type { Meta, StoryObj } from '@storybook/react-vite';
import { InvoiceNotificationPrompt } from './InvoiceNotificationPrompt';

const meta: Meta<typeof InvoiceNotificationPrompt> = {
  title: 'Components/Invoice/InvoiceNotificationPrompt',
  component: InvoiceNotificationPrompt,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    invoiceId: { control: 'text' },
    dueDate: { control: 'number' },
    isPartyToInvoice: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    invoiceId: 'INV-12345',
    dueDate: Math.floor(Date.now() / 1000) + 86400 * 3,
    isPartyToInvoice: true,
  },
};

export const NotParty: Story = {
  args: {
    invoiceId: 'INV-12345',
    dueDate: Math.floor(Date.now() / 1000) + 86400 * 3,
    isPartyToInvoice: false,
  },
};
