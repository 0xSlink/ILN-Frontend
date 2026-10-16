import type { Meta, StoryObj } from '@storybook/react-vite';
import FABProvider from './FABProvider';

const meta: Meta<typeof FABProvider> = {
  title: 'Components/FABProvider',
  component: FABProvider,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
