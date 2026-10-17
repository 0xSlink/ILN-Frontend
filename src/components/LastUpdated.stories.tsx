import type { Meta, StoryObj } from '@storybook/react-vite';
import LastUpdated from './LastUpdated';

const meta: Meta<typeof LastUpdated> = {
  title: 'Components/LastUpdated',
  component: LastUpdated,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    updatedAt: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const JustNow: Story = {
  args: {
    updatedAt: Date.now(),
  },
};

export const FewSecondsAgo: Story = {
  args: {
    updatedAt: Date.now() - 5000,
  },
};
