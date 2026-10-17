import type { Meta, StoryObj } from '@storybook/react-vite';
import SubmitInvoiceForm from './SubmitInvoiceForm';

const meta: Meta<typeof SubmitInvoiceForm> = {
  title: 'Components/SubmitInvoiceForm',
  component: SubmitInvoiceForm,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    initialValues: { control: 'object' },
    prefillId: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPrefill: Story = {
  args: {
    prefillId: 'INV-12345',
  },
};
