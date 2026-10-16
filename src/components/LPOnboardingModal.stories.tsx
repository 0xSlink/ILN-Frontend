import type { Meta, StoryObj } from '@storybook/react-vite';
import LPOnboardingModal from './LPOnboardingModal';

const meta: Meta<typeof LPOnboardingModal> = {
  title: 'Components/LPOnboardingModal',
  component: LPOnboardingModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    onGoToMarketplace: () => {},
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
    onGoToMarketplace: () => {},
  },
};
