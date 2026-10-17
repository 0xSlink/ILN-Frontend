import type { Meta, StoryObj } from '@storybook/react-vite';
import WhatsNewModal from './WhatsNewModal';

const meta: Meta<typeof WhatsNewModal> = {
  title: 'Components/Modals/WhatsNewModal',
  component: WhatsNewModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
