import type { Meta, StoryObj } from '@storybook/react-vite';
import GovernanceActivity from './GovernanceActivity';

const meta: Meta<typeof GovernanceActivity> = {
  title: 'Components/GovernanceActivity',
  component: GovernanceActivity,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    address: 'GABC12345678901234567890123456789012345678901234567890123456',
  },
};
