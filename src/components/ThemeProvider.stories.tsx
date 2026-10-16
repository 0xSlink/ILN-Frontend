import type { Meta, StoryObj } from '@storybook/react-vite';
import ThemeProvider from './ThemeProvider';

const meta: Meta<typeof ThemeProvider> = {
  title: 'Components/ThemeProvider',
  component: ThemeProvider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <div className="p-4 text-on-surface bg-surface rounded-lg">Themed content</div>,
  },
};
