import type { Meta, StoryObj } from '@storybook/react-vite';
import HowItWorks from './HowItWorks';

const meta: Meta<typeof HowItWorks> = {
  title: 'Components/HowItWorks',
  component: HowItWorks,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
