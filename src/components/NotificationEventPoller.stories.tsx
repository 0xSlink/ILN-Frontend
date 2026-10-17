import type { Meta, StoryObj } from '@storybook/react-vite';
import NotificationEventPoller from './NotificationEventPoller';

const meta: Meta<typeof NotificationEventPoller> = {
  title: 'Components/NotificationEventPoller',
  component: NotificationEventPoller,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
