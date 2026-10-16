import type { Meta, StoryObj } from '@storybook/react-vite';
import AmountHistogram from './AmountHistogram';

const meta: Meta<typeof AmountHistogram> = {
  title: 'Components/Charts/AmountHistogram',
  component: AmountHistogram,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    invoices: [],
  },
};

export const Empty: Story = {
  args: {
    invoices: [],
  },
};
