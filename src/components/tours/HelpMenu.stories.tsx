import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelpMenu } from './HelpMenu';

const meta: Meta<typeof HelpMenu> = {
  title: 'Components/Tours/HelpMenu',
  component: HelpMenu,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    tourId: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tourId: 'freelancer-dashboard' as any,
  },
};

export const WithCustomLinks: Story = {
  args: {
    tourId: 'lp-dashboard' as any,
    docLinks: [
      { label: 'LP Guide', href: 'https://docs.iln.finance/lp' },
      { label: 'Yield Calculator', href: 'https://docs.iln.finance/yield' },
    ],
  },
};
