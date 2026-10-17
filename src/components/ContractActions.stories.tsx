import type { Meta, StoryObj } from '@storybook/react-vite';
import ContractActions from './ContractActions';

const meta: Meta<typeof ContractActions> = {
  title: 'Components/ContractActions',
  component: ContractActions,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
