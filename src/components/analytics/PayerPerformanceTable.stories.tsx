import type { Meta, StoryObj } from '@storybook/react-vite';
import PayerPerformanceTable from './PayerPerformanceTable';
import type { PayerPerformance } from '@/utils/lp-analytics';

const mockData: PayerPerformance[] = [
  {
    payer: 'GABCDEF123456789',
    totalInvoices: 45,
    fundedAmount: 100000000n,
    totalYield: 5000000n,
    defaultRate: 2.3,
  },
  {
    payer: 'GHIJKL987654321',
    totalInvoices: 23,
    fundedAmount: 50000000n,
    totalYield: 2500000n,
    defaultRate: 0.5,
  },
  {
    payer: 'GMNOPQ456789123',
    totalInvoices: 67,
    fundedAmount: 200000000n,
    totalYield: 12000000n,
    defaultRate: 6.1,
  },
];

const meta: Meta<typeof PayerPerformanceTable> = {
  title: 'Components/Analytics/PayerPerformanceTable',
  component: PayerPerformanceTable,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: mockData,
  },
};

export const Empty: Story = {
  args: {
    data: [],
  },
};
