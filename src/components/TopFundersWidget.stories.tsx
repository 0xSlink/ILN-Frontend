import type { Meta, StoryObj } from '@storybook/react-vite';
import TopFundersWidget from './TopFundersWidget';

const meta: Meta<typeof TopFundersWidget> = {
  title: 'Components/TopFundersWidget',
  component: TopFundersWidget,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
