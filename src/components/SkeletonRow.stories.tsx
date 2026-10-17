import type { Meta, StoryObj } from '@storybook/react-vite';
import SkeletonRow, { LP_DISCOVERY_COLUMNS, FREELANCER_COLUMNS } from './SkeletonRow';

const meta: Meta<typeof SkeletonRow> = {
  title: 'Components/SkeletonRow',
  component: SkeletonRow,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    columns: { control: 'object' },
    rowClass: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const LPDiscovery: Story = {
  args: {
    columns: LP_DISCOVERY_COLUMNS,
  },
};

export const Freelancer: Story = {
  args: {
    columns: FREELANCER_COLUMNS,
  },
};

export const CustomRowClass: Story = {
  args: {
    columns: LP_DISCOVERY_COLUMNS,
    rowClass: 'py-8',
  },
};
