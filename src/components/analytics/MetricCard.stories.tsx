import type { Meta, StoryObj } from '@storybook/react-vite';
import MetricCard from './MetricCard';

const meta: Meta<typeof MetricCard> = {
  title: 'Components/Analytics/MetricCard',
  component: MetricCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    accent: { control: 'boolean' },
    icon: { control: 'text' },
    label: { control: 'text' },
    sub: { control: 'text' },
    tooltip: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: 'metric-1',
    icon: 'receipt_long',
    label: 'Total Invoices',
    value: '1,247',
    sub: 'All invoices on-chain',
  },
};

export const Accent: Story = {
  args: {
    id: 'metric-2',
    icon: 'paid',
    label: 'Total Volume',
    value: '$2.4M',
    sub: 'USD-equivalent funded',
    accent: true,
  },
};

export const WithTooltip: Story = {
  args: {
    id: 'metric-3',
    icon: 'savings',
    label: 'Protocol Fees',
    value: '$12,500',
    tooltip: 'Fees collected by the protocol',
    badge: (
      <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
        0% FEE
      </span>
    ),
  },
};
