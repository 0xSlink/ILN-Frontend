import type { Meta, StoryObj } from '@storybook/react-vite';
import FloatingActionButton from './FloatingActionButton';

const meta: Meta<typeof FloatingActionButton> = {
  title: 'Components/FloatingActionButton',
  component: FloatingActionButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    visible: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {
  args: {
    visible: true,
  },
};

export const Hidden: Story = {
  args: {
    visible: false,
  },
};
