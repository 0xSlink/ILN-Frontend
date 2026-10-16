import type { Meta, StoryObj } from '@storybook/react-vite';
import { BatchExportButton } from './BatchExportButton';

const meta: Meta<typeof BatchExportButton> = {
  title: 'Components/BatchExportButton',
  component: BatchExportButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockItems = [
  { id: '1', amount: '1000', status: 'paid' },
  { id: '2', amount: '2500', status: 'pending' },
];

export const WithItems: Story = {
  args: {
    selectedItems: mockItems,
    filenamePrefix: 'invoices',
  },
};

export const Empty: Story = {
  args: {
    selectedItems: [],
    filenamePrefix: 'invoices',
  },
};
