import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './Textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Components/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
    rows: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter description...',
  },
};

export const WithValue: Story = {
  args: {
    value: 'Sample text content',
    onChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    value: 'Disabled textarea',
    disabled: true,
  },
};

export const CustomRows: Story = {
  args: {
    placeholder: 'Large text area...',
    rows: 6,
  },
};
