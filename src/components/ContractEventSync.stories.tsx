import type { Meta, StoryObj } from '@storybook/react-vite';
import ContractEventSync from './ContractEventSync';

const meta: Meta<typeof ContractEventSync> = {
  title: 'Components/ContractEventSync',
  component: ContractEventSync,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
