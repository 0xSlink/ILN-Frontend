import type { Meta, StoryObj } from '@storybook/react-vite';
import { YieldBarChart, CapitalLineChart, OutcomePieChart } from './LPCharts';

const meta: Meta<typeof YieldBarChart> = {
  title: 'Components/Analytics/LPCharts',
  component: YieldBarChart,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockYieldData = [
  { name: 'Week 1', yield: 120 },
  { name: 'Week 2', yield: 85 },
  { name: 'Week 3', yield: 200 },
  { name: 'Week 4', yield: 150 },
];

const mockTimeData = [
  { time: 'Jan', capital: 5000, yield: 100 },
  { time: 'Feb', capital: 8000, yield: 250 },
  { time: 'Mar', capital: 12000, yield: 400 },
];

const mockPieData = [
  { name: 'Paid', value: 65 },
  { name: 'Pending', value: 25 },
  { name: 'Defaulted', value: 10 },
];

export const YieldBar: Story = {
  render: () => <YieldBarChart data={mockYieldData} />,
};

export const CapitalLine: Story = {
  render: () => <CapitalLineChart data={mockTimeData} />,
};

export const OutcomePie: Story = {
  render: () => <OutcomePieChart data={mockPieData} />,
};

export const Empty: Story = {
  render: () => <YieldBarChart data={[]} />,
};
