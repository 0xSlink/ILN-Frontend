import type { Meta, StoryObj } from '@storybook/react-vite';
import LPYieldComparison from './LPYieldComparison';

const meta: Meta<typeof LPYieldComparison> = {
  title: 'Components/LPYieldComparison',
  component: LPYieldComparison,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    invoices: [],
    lpAddress: 'GABC12345678901234567890123456789012345678901234567890123456',
  },
};

export const Loading: Story = {
  args: {
    invoices: [],
    lpAddress: 'GABC12345678901234567890123456789012345678901234567890123456',
    isLoading: true,
  },
};
