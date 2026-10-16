import type { Meta, StoryObj } from '@storybook/react-vite';
import { DelegationPanel } from './DelegationPanel';

const meta: Meta<typeof DelegationPanel> = {
  title: 'Components/Governance/DelegationPanel',
  component: DelegationPanel,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
