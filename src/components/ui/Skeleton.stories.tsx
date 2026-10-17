import type { Meta, StoryObj } from '@storybook/react-vite';
import Skeleton from './Skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Components/UI/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: {
    className: 'h-4 w-32',
  },
};

export const Avatar: Story = {
  args: {
    className: 'h-10 w-10 rounded-full',
  },
};

export const Card: Story = {
  args: {
    className: 'h-24 w-64 rounded-2xl',
  },
};
