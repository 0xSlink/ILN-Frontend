import type { Meta, StoryObj } from '@storybook/react-vite';
import WalletSelectionModal from './WalletSelectionModal';

const meta: Meta<typeof WalletSelectionModal> = {
  title: 'Components/WalletSelectionModal',
  component: WalletSelectionModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClose: { action: 'closed' },
    onSelectFreighter: { action: 'selected freighter' },
    onSelectWalletConnect: { action: 'selected walletconnect' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onClose: () => {},
    onSelectFreighter: () => {},
    onSelectWalletConnect: () => {},
  },
};

export const WalletConnectView: Story = {
  args: {
    onClose: () => {},
    onSelectFreighter: () => {},
    onSelectWalletConnect: () => {},
    initialWalletConnectView: true,
  },
};
