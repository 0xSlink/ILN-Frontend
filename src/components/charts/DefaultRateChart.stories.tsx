import type { Meta, StoryObj } from '@storybook/react-vite';
import DefaultRateChart from './DefaultRateChart';

const meta: Meta<typeof DefaultRateChart> = {
  title: 'Components/Charts/DefaultRateChart',
  component: DefaultRateChart,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
