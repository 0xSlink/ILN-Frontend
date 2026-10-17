import type { Meta, StoryObj } from '@storybook/react-vite';
import { AmountTooltip } from './AmountTooltip';

const meta: Meta<typeof AmountTooltip> = {
  title: 'Components/AmountTooltip',
  component: AmountTooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    breakdown: {
      control: 'object',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Freelancer: Story = {
  args: {
    breakdown: { type: 'freelancer', invoiceAmount: 1000000000n, discountBps: 300 },
    children: '$1,000.00',
  },
};

export const LP: Story = {
  args: {
    breakdown: { type: 'lp', amountSent: 1000000000n, discountBps: 300 },
    children: '$1,000.00',
  },
};

export const Protocol: Story = {
  args: {
    breakdown: { type: 'protocol', discountAmount: 30000000n, protocolFeeBps: 1000 },
    children: '$30.00',
  },
};
