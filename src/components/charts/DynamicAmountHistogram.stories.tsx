import type { Meta, StoryObj } from '@storybook/react-vite';
import DynamicAmountHistogram from './DynamicAmountHistogram';

const meta: Meta<typeof DynamicAmountHistogram> = {
  title: 'Components/Charts/DynamicAmountHistogram',
  component: DynamicAmountHistogram,
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
