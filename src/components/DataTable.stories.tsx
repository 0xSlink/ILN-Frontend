import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import DataTable, { DataTableColumn } from './DataTable';

const meta: Meta<typeof DataTable> = {
  title: 'Components/DataTable',
  component: DataTable,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

interface SampleItem {
  id: number;
  name: string;
  email: string;
  status: string;
  amount: number;
}

const sampleData: SampleItem[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active', amount: 1000 },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Pending', amount: 2500 },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'Inactive', amount: 750 },
];

const columns: DataTableColumn<SampleItem>[] = [
  {
    id: 'name',
    label: 'Name',
    sortable: true,
    renderCell: (item) => <span>{item.name}</span>,
  },
  {
    id: 'email',
    label: 'Email',
    sortable: true,
    renderCell: (item) => <span>{item.email}</span>,
  },
  {
    id: 'status',
    label: 'Status',
    sortable: false,
    renderCell: (item) => (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          item.status === 'Active'
            ? 'bg-green-100 text-green-800'
            : item.status === 'Pending'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
        }`}
      >
        {item.status}
      </span>
    ),
  },
  {
    id: 'amount',
    label: 'Amount',
    sortable: true,
    renderCell: (item) => <span>${item.amount.toLocaleString()}</span>,
  },
];

export const Default: Story = {
  args: {
    data: sampleData,
    columns: columns as any,
    keyExtractor: (item: any) => String(item.id),
  },
};

export const Loading: Story = {
  args: {
    data: [],
    columns: columns as any,
    keyExtractor: (item: any) => String(item.id),
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    data: [],
    columns: columns as any,
    keyExtractor: (item: any) => String(item.id),
    emptyMessage: 'No data available',
  },
};
