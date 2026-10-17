import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import BatchInvoiceForm from './BatchInvoiceForm';

const meta: Meta<typeof BatchInvoiceForm> = {
  title: 'Components/BatchInvoiceForm',
  component: BatchInvoiceForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSuccess: fn((results) => `Batch result: ${results}`),
  },
};
