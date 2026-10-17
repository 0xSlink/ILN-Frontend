import type { Meta, StoryObj } from '@storybook/react-vite';
import QuickSubmitDrawer from './QuickSubmitDrawer';

const meta: Meta<typeof QuickSubmitDrawer> = {
  title: 'Components/QuickSubmitDrawer',
  component: QuickSubmitDrawer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
  },
};

export const Open: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
  },
};
