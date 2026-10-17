import type { Meta, StoryObj } from '@storybook/react-vite';
import ProfileActivityChart from './ProfileActivityChart';

const meta: Meta<typeof ProfileActivityChart> = {
  title: 'Components/ProfileActivityChart',
  component: ProfileActivityChart,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockData = [
  { period: 'Jan', score: 85 },
  { period: 'Feb', score: 72 },
  { period: 'Mar', score: 90 },
  { period: 'Apr', score: 88 },
  { period: 'May', score: 95 },
];

export const Default: Story = {
  args: {
    data: mockData,
  },
};

export const Empty: Story = {
  args: {
    data: [],
  },
};
