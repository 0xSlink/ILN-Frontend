import type { Meta, StoryObj } from '@storybook/react-vite';
import InvoiceFilterBar from './InvoiceFilterBar';

const meta: Meta<typeof InvoiceFilterBar> = {
  title: 'Components/InvoiceFilterBar',
  component: InvoiceFilterBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const defaultFilters = {
  search: '',
  statuses: [] as string[],
  minAmount: '',
  maxAmount: '',
  startDate: '',
  endDate: '',
  token: '',
  minDiscountBps: '',
  maxDiscountBps: '',
  minPayerReputation: '',
};

export const Default: Story = {
  args: {
    filters: defaultFilters,
    onFiltersChange: () => {},
    onClearFilters: () => {},
    activeFilterCount: 0,
  },
};

export const WithActiveFilters: Story = {
  args: {
    filters: { ...defaultFilters, statuses: ['Pending'], token: 'USDC' },
    onFiltersChange: () => {},
    onClearFilters: () => {},
    activeFilterCount: 2,
  },
};
