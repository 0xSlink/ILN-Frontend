import type { Meta, StoryObj } from '@storybook/react-vite';
import InvoiceStateDonut from './InvoiceStateDonut';

const meta: Meta<typeof InvoiceStateDonut> = {
  title: 'Components/InvoiceStateDonut',
  component: InvoiceStateDonut,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
