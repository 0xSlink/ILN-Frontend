import type { Meta, StoryObj } from '@storybook/react-vite';
import Spotlight from './Spotlight';

const meta: Meta<typeof Spotlight> = {
  title: 'Components/Onboarding/Spotlight',
  component: Spotlight,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    onNext: { action: 'next' },
    onSkip: { action: 'skip' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Welcome to ILN',
    content: 'This is the invoice submission form. Enter the payer address, amount, and due date.',
    currentStep: 0,
    totalSteps: 3,
    onNext: () => {},
    onSkip: () => {},
  },
};

export const LastStep: Story = {
  args: {
    title: "You're all set!",
    content: 'You have completed the onboarding tour. Start using the platform.',
    currentStep: 2,
    totalSteps: 3,
    onNext: () => {},
    onSkip: () => {},
  },
};

export const WithTarget: Story = {
  args: {
    targetId: 'submit-invoice-form',
    title: 'Submit Invoice Form',
    content: 'Fill in the details and submit your invoice.',
    currentStep: 1,
    totalSteps: 3,
    onNext: () => {},
    onSkip: () => {},
  },
};
