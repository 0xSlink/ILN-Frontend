import type { Meta, StoryObj } from '@storybook/react-vite';
import YieldAnalyticsChart from './YieldAnalyticsChart';

const meta: Meta<typeof YieldAnalyticsChart> = {
  title: 'Components/YieldAnalyticsChart',
  component: YieldAnalyticsChart,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    isLoading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    invoices: [],
    lpAddress: 'GABCDEF123456789',
  },
};

export const Loading: Story = {
  args: {
    invoices: [],
    lpAddress: 'GABCDEF123456789',
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    invoices: [],
    lpAddress: 'GABCDEF123456789',
  },
};
