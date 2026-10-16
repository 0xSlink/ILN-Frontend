import type { Meta, StoryObj } from '@storybook/react-vite';
import InvoiceTable from './InvoiceTable';

const meta: Meta<typeof InvoiceTable> = {
  title: 'Components/InvoiceTable',
  component: InvoiceTable,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const columns = [
  {
    id: 'id',
    label: 'ID',
    isMandatory: true,
    renderCell: (item: any) => <span className="font-mono">#{item.id}</span>,
  },
  { id: 'amount', label: 'Amount', renderCell: (item: any) => <span>{item.amount}</span> },
  { id: 'status', label: 'Status', renderCell: (item: any) => <span>{item.status}</span> },
];

const data = [
  { id: '1', amount: '$1,000', status: 'Paid' },
  { id: '2', amount: '$2,500', status: 'Pending' },
  { id: '3', amount: '$500', status: 'Funded' },
];

export const Default: Story = {
  args: {
    tableId: 'test-table',
    data,
    columns,
    keyExtractor: (item: any) => item.id,
  },
};

export const WithSelection: Story = {
  args: {
    tableId: 'test-table-select',
    data,
    columns,
    keyExtractor: (item: any) => item.id,
    selectedKeys: new Set(['1']),
    onSelectionChange: () => {},
  },
};

export const Loading: Story = {
  args: {
    tableId: 'test-table-loading',
    data: [],
    columns,
    keyExtractor: (item: any) => item.id,
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    tableId: 'test-table-empty',
    data: [],
    columns,
    keyExtractor: (item: any) => item.id,
    emptyMessage: 'No invoices found.',
  },
};
