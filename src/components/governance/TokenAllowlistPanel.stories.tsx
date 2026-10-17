import type { Meta, StoryObj } from '@storybook/react-vite';
import TokenAllowlistPanel from './TokenAllowlistPanel';

const meta: Meta<typeof TokenAllowlistPanel> = {
  title: 'Components/Governance/TokenAllowlistPanel',
  component: TokenAllowlistPanel,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
