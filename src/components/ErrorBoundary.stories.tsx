import type { Meta, StoryObj } from '@storybook/react-vite';
import ErrorBoundary from './ErrorBoundary';

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <div className="p-8 text-center">This content is wrapped in an error boundary.</div>,
  },
};

export const WithFallbackMessage: Story = {
  args: {
    children: <div>Safe content</div>,
    fallbackMessage: 'Custom error message for this section.',
  },
};
