import type { Meta, StoryObj } from '@storybook/react-vite';
import AuctionRateTicker from './AuctionRateTicker';

const meta: Meta<typeof AuctionRateTicker> = {
  title: 'Components/AuctionRateTicker',
  component: AuctionRateTicker,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    startRate: { control: 'number' },
    minRate: { control: 'number' },
    auctionStartTime: { control: 'number' },
    auctionDurationSeconds: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: {
    startRate: 500,
    minRate: 100,
    auctionStartTime: Math.floor(Date.now() / 1000) - 3600,
    auctionDurationSeconds: 86400,
  },
};

export const Expired: Story = {
  args: {
    startRate: 500,
    minRate: 100,
    auctionStartTime: Math.floor(Date.now() / 1000) - 86400 * 2,
    auctionDurationSeconds: 86400,
  },
};

export const FlatRate: Story = {
  args: {
    startRate: 300,
    minRate: 300,
    auctionStartTime: Math.floor(Date.now() / 1000),
    auctionDurationSeconds: 86400,
  },
};
