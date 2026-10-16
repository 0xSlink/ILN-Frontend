import type { Meta, StoryObj } from '@storybook/react-vite';
import Stats from './Stats';

const meta: Meta<typeof Stats> = {
  title: 'Components/Stats',
  component: Stats,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
