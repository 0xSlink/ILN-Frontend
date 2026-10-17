import type { Meta, StoryObj } from '@storybook/react-vite';
import TestnetFaucetButton from './TestnetFaucetButton';

const meta: Meta<typeof TestnetFaucetButton> = {
  title: 'Components/TestnetFaucetButton',
  component: TestnetFaucetButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
