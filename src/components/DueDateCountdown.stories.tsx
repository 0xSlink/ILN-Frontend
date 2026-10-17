import type { Meta, StoryObj } from '@storybook/react-vite';
import DueDateCountdown from './DueDateCountdown';

const meta: Meta<typeof DueDateCountdown> = {
  title: 'Components/DueDateCountdown',
  component: DueDateCountdown,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    showClaimButton: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const FarOut: Story = {
  args: {
    dueDate: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
  },
};

export const WithinWeek: Story = {
  args: {
    dueDate: BigInt(Math.floor(Date.now() / 1000) + 86400 * 3),
  },
};

export const WithinDay: Story = {
  args: {
    dueDate: BigInt(Math.floor(Date.now() / 1000) + 3600 * 6),
  },
};

export const Overdue: Story = {
  args: {
    dueDate: BigInt(Math.floor(Date.now() / 1000) - 86400),
    showClaimButton: true,
    onClaimDefault: () => {},
  },
};
