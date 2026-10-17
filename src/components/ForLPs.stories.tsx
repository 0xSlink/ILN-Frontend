import type { Meta, StoryObj } from '@storybook/react-vite';
import ForLPs from './ForLPs';

const meta: Meta<typeof ForLPs> = {
  title: 'Components/ForLPs',
  component: ForLPs,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
