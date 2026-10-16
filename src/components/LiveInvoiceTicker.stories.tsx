import type { Meta, StoryObj } from '@storybook/react-vite';
import LiveInvoiceTicker from './LiveInvoiceTicker';

const meta: Meta<typeof LiveInvoiceTicker> = {
  title: 'Components/LiveInvoiceTicker',
  component: LiveInvoiceTicker,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
