import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExportButton } from './ExportButton';

const meta: Meta<typeof ExportButton> = {
  title: 'Components/ExportButton',
  component: ExportButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockData = [
  { id: '1', amount: '1000', status: 'paid', date: '2024-01-15' },
  { id: '2', amount: '2500', status: 'pending', date: '2024-02-01' },
  { id: '3', amount: '500', status: 'funded', date: '2024-02-10' },
];

export const Default: Story = {
  args: {
    data: mockData,
    filenamePrefix: 'invoices',
  },
};

export const WithColumns: Story = {
  args: {
    data: mockData,
    filenamePrefix: 'invoices',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'amount', label: 'Amount' },
      { key: 'status', label: 'Status' },
    ],
  },
};

export const Empty: Story = {
  args: {
    data: [],
    filenamePrefix: 'invoices',
  },
};
