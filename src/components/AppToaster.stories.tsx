import type { Meta, StoryObj } from '@storybook/react-vite';
import AppToaster from './AppToaster';

const meta: Meta<typeof AppToaster> = {
  title: 'Components/AppToaster',
  component: AppToaster,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
