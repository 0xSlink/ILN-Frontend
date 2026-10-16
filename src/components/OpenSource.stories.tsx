import type { Meta, StoryObj } from '@storybook/react-vite';
import OpenSource from './OpenSource';

const meta: Meta<typeof OpenSource> = {
  title: 'Components/OpenSource',
  component: OpenSource,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
