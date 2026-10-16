import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  FreelancerEmptyIllustration,
  LPDiscoveryEmptyIllustration,
  LPPortfolioEmptyIllustration,
  PayerEmptyIllustration,
  NotificationsEmptyIllustration,
} from './EmptyIllustrations';

const meta: Meta<typeof FreelancerEmptyIllustration> = {
  title: 'Components/Illustrations/EmptyIllustrations',
  component: FreelancerEmptyIllustration,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Freelancer: Story = {
  render: () => <FreelancerEmptyIllustration className="w-48 h-48" />,
};

export const LPDiscovery: Story = {
  render: () => <LPDiscoveryEmptyIllustration className="w-48 h-48" />,
};

export const LPPortfolio: Story = {
  render: () => <LPPortfolioEmptyIllustration className="w-48 h-48" />,
};

export const Payer: Story = {
  render: () => <PayerEmptyIllustration className="w-48 h-48" />,
};

export const Notifications: Story = {
  render: () => <NotificationsEmptyIllustration className="w-48 h-48" />,
};
