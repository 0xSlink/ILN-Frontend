import type { Meta, StoryObj } from '@storybook/react-vite';
import ShortcutsModal from './ShortcutsModal';

const meta: Meta<typeof ShortcutsModal> = {
  title: 'Components/ShortcutsModal',
  component: ShortcutsModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
  },
};
