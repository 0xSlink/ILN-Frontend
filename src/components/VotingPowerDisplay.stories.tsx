import type { Meta, StoryObj } from '@storybook/react-vite';
import VotingPowerDisplay from './VotingPowerDisplay';

const meta: Meta<typeof VotingPowerDisplay> = {
  title: 'Components/VotingPowerDisplay',
  component: VotingPowerDisplay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    votingPower: { control: 'number' },
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    votingPower: 50000,
  },
};

export const ZeroPower: Story = {
  args: {
    votingPower: 0,
  },
};

export const LargePower: Story = {
  args: {
    votingPower: 2500000,
  },
};
