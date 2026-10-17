import type { Meta, StoryObj } from '@storybook/react-vite';
import RecentTransactionsPanel from './RecentTransactionsPanel';

const meta: Meta<typeof RecentTransactionsPanel> = {
  title: 'Components/RecentTransactionsPanel',
  component: RecentTransactionsPanel,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
