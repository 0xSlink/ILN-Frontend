import type { Meta, StoryObj } from '@storybook/react-vite';
import LPSettingsModal from './LPSettingsModal';

const meta: Meta<typeof LPSettingsModal> = {
  title: 'Components/LPSettingsModal',
  component: LPSettingsModal,
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
