import type { Meta, StoryObj } from '@storybook/react-vite';
import InsurancePoolPanel from './InsurancePoolPanel';

const meta: Meta<typeof InsurancePoolPanel> = {
  title: 'Components/InsurancePoolPanel',
  component: InsurancePoolPanel,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
