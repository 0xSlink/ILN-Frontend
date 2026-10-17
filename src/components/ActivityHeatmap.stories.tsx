import type { Meta, StoryObj } from '@storybook/react-vite';
import ActivityHeatmap from './ActivityHeatmap';

const meta: Meta<typeof ActivityHeatmap> = {
  title: 'Components/ActivityHeatmap',
  component: ActivityHeatmap,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    address: 'GABC12345678901234567890123456789012345678901234567890123456',
    invoices: [],
  },
};
