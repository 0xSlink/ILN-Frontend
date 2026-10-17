import type { Meta, StoryObj } from '@storybook/react-vite';
import DynamicDefaultRateChart from './DynamicDefaultRateChart';

const meta: Meta<typeof DynamicDefaultRateChart> = {
  title: 'Components/Charts/DynamicDefaultRateChart',
  component: DynamicDefaultRateChart,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
