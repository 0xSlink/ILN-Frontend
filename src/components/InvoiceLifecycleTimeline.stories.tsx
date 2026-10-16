import type { Meta, StoryObj } from '@storybook/react-vite';
import InvoiceLifecycleTimeline from './InvoiceLifecycleTimeline';

const meta: Meta<typeof InvoiceLifecycleTimeline> = {
  title: 'Components/InvoiceLifecycleTimeline',
  component: InvoiceLifecycleTimeline,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['Pending', 'Funded', 'Paid', 'Cancelled', 'Defaulted', 'Disputed'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  args: { status: 'Pending' },
};

export const Funded: Story = {
  args: { status: 'Funded' },
};

export const Paid: Story = {
  args: { status: 'Paid' },
};

export const Cancelled: Story = {
  args: { status: 'Cancelled' },
};

export const Defaulted: Story = {
  args: { status: 'Defaulted' },
};

export const Disputed: Story = {
  args: { status: 'Disputed' },
};
