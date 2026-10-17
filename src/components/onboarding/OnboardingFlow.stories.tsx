import type { Meta, StoryObj } from '@storybook/react-vite';
import OnboardingFlow from './OnboardingFlow';

const meta: Meta<typeof OnboardingFlow> = {
  title: 'Components/Onboarding/OnboardingFlow',
  component: OnboardingFlow,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
