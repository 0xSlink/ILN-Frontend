import type { Meta, StoryObj } from '@storybook/react-vite';
import OracleBadge from './OracleBadge';

const meta: Meta<typeof OracleBadge> = {
  title: 'Components/OracleBadge',
  component: OracleBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    verified: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Verified: Story = {
  args: {
    verified: true,
  },
};

export const Unverified: Story = {
  args: {
    verified: false,
  },
};
