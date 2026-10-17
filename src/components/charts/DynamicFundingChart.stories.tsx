import type { Meta, StoryObj } from '@storybook/react-vite';
import DynamicFundingChart from './DynamicFundingChart';

const meta: Meta<typeof DynamicFundingChart> = {
  title: 'Components/Charts/DynamicFundingChart',
  component: DynamicFundingChart,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
