import type { Meta, StoryObj } from '@storybook/react-vite';
import FundingChart from './FundingChart';

const meta: Meta<typeof FundingChart> = {
  title: 'Components/Charts/FundingChart',
  component: FundingChart,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
