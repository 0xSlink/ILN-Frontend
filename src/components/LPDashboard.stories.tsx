import type { Meta, StoryObj } from '@storybook/react-vite';
import LPDashboard from './LPDashboard';

const meta: Meta<typeof LPDashboard> = {
  title: 'Components/LPDashboard',
  component: LPDashboard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
