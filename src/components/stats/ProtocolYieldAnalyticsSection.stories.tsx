import type { Meta, StoryObj } from '@storybook/react-vite';
import ProtocolYieldAnalyticsSection from './ProtocolYieldAnalyticsSection';

const meta: Meta<typeof ProtocolYieldAnalyticsSection> = {
  title: 'Components/Stats/ProtocolYieldAnalyticsSection',
  component: ProtocolYieldAnalyticsSection,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    isLoading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    invoices: [],
  },
};

export const Loading: Story = {
  args: {
    invoices: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    invoices: [],
  },
};
