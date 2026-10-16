import type { Meta, StoryObj } from '@storybook/react-vite';
import { PageTour } from './PageTour';

const meta: Meta<typeof PageTour> = {
  title: 'Components/Tours/PageTour',
  component: PageTour,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    onFinish: { action: 'finished' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tourId: 'freelancer-dashboard' as any,
    run: false,
    onFinish: () => {},
  },
};
