import type { Meta, StoryObj } from '@storybook/react-vite';
import FieldTooltip from './FieldTooltip';

const meta: Meta<typeof FieldTooltip> = {
  title: 'Components/FieldTooltip',
  component: FieldTooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: 'This is a helpful explanation for the field above.',
  },
};

export const WithCustomTrigger: Story = {
  args: {
    content: 'This fee is calculated as a percentage of the total amount.',
    trigger: <span className="text-xs font-bold text-primary">?</span>,
  },
};

export const RichContent: Story = {
  args: {
    content: (
      <div>
        <p className="font-semibold mb-1">Details</p>
        <p>The discount rate determines your yield on funding this invoice.</p>
      </div>
    ),
  },
};
