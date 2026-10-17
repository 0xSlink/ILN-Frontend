import type { Meta, StoryObj } from '@storybook/react-vite';
import PersonalizedDashboard from './PersonalizedDashboard';

const meta: Meta<typeof PersonalizedDashboard> = {
  title: 'Components/PersonalizedDashboard',
  component: PersonalizedDashboard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
