import type { Meta, StoryObj } from '@storybook/react-vite';
import DynamicYieldAnalyticsChart from './DynamicYieldAnalyticsChart';

const meta: Meta<typeof DynamicYieldAnalyticsChart> = {
  title: 'Components/DynamicYieldAnalyticsChart',
  component: DynamicYieldAnalyticsChart,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
