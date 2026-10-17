import type { Meta, StoryObj } from '@storybook/react-vite';
import ReputationHistoryChart from './ReputationHistoryChart';

const meta: Meta<typeof ReputationHistoryChart> = {
  title: 'Components/ReputationHistoryChart',
  component: ReputationHistoryChart,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    events: [],
  },
};
