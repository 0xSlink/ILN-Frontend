import type { Meta, StoryObj } from '@storybook/react-vite';
import YieldCalculator from './YieldCalculator';

const meta: Meta<typeof YieldCalculator> = {
  title: 'Components/YieldCalculator',
  component: YieldCalculator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onFindMatching: { action: 'find matching' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onFindMatching: () => {},
  },
};
