import type { Meta, StoryObj } from '@storybook/react-vite';
import ForFreelancers from './ForFreelancers';

const meta: Meta<typeof ForFreelancers> = {
  title: 'Components/ForFreelancers',
  component: ForFreelancers,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
