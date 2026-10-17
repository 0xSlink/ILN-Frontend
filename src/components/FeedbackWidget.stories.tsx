import type { Meta, StoryObj } from '@storybook/react-vite';
import FeedbackWidget from './FeedbackWidget';

const meta: Meta<typeof FeedbackWidget> = {
  title: 'Components/FeedbackWidget',
  component: FeedbackWidget,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
