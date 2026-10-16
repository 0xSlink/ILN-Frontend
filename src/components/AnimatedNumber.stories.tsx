import type { Meta, StoryObj } from '@storybook/react-vite';
import AnimatedNumber from './AnimatedNumber';

const meta: Meta<typeof AnimatedNumber> = {
  title: 'Components/AnimatedNumber',
  component: AnimatedNumber,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'number' },
    duration: { control: 'number' },
    reanimateOnChange: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 1000000,
  },
};

export const WithFormatter: Story = {
  args: {
    value: 1000000,
    formatter: (v) => `$${v.toLocaleString()}`,
  },
};

export const FastAnimation: Story = {
  args: {
    value: 5000,
    duration: 500,
  },
};
