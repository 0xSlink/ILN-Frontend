import type { Meta, StoryObj } from '@storybook/react-vite';
import DynamicInvoicePdfButton from './DynamicInvoicePdfButton';

const meta: Meta<typeof DynamicInvoicePdfButton> = {
  title: 'Components/DynamicInvoicePdfButton',
  component: DynamicInvoicePdfButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
