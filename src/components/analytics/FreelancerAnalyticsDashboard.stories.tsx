import type { Meta, StoryObj } from '@storybook/react-vite';
import FreelancerAnalyticsDashboard from './FreelancerAnalyticsDashboard';

const meta: Meta<typeof FreelancerAnalyticsDashboard> = {
  title: 'Components/Analytics/FreelancerAnalyticsDashboard',
  component: FreelancerAnalyticsDashboard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
