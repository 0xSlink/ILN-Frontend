import type { Meta, StoryObj } from '@storybook/react-vite';
import StatsVolumeChart from './StatsVolumeChart';

const meta: Meta<typeof StatsVolumeChart> = {
  title: 'Components/Stats/StatsVolumeChart',
  component: StatsVolumeChart,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    dailyVolume: [],
  },
};

export const Empty: Story = {
  args: {
    dailyVolume: [],
  },
};
