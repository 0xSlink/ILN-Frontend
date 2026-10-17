import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import DestinationConfirmationInput from './DestinationConfirmationInput';

const meta: Meta<typeof DestinationConfirmationInput> = {
  title: 'Components/DestinationConfirmationInput',
  component: DestinationConfirmationInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    destinationAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    onConfirmationChange: fn(),
    requiredLength: 6,
    label: 'Confirm Destination Address',
  },
};
