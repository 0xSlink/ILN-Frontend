import type { Meta, StoryObj } from '@storybook/react-vite';
import InsurancePoolPanel from './InsurancePoolPanel';

const meta: Meta<typeof InsurancePoolPanel> = {
  title: 'Components/InsurancePoolPanel',
  component: InsurancePoolPanel,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// ── Dark-feature visual regression baselines (Closes #41) ────────────────────
//
// These stories capture the Insurance Pool UI with the feature flag FORCED ON
// so that Chromatic can establish a visual baseline for the enabled state.
//
// They are tagged `dark-feature` so the visual-regression workflow can target
// them selectively, and they are NOT gated on the real environment variable —
// the `env` parameter override is used by the Storybook preview decorator to
// expose the component regardless of the build-time flag value.
//
// Do NOT run these against a production Storybook build where the flag is off;
// use a preview/staging build where NEXT_PUBLIC_INSURANCE_POOL_ENABLED=true, or
// rely on the Chromatic run which renders stories in isolation.

/**
 * Insurance Pool panel with the feature flag enabled — enrolled state.
 * Visual baseline for the post-flip appearance (Chromatic).
 */
export const FlagEnabled: Story = {
  tags: ['dark-feature', 'chromatic'],
  parameters: {
    // Override the build-time env var for isolated story rendering.
    // The Storybook preview decorator reads this and passes it to the component.
    env: {
      NEXT_PUBLIC_INSURANCE_POOL_ENABLED: 'true',
    },
    chromatic: {
      // Capture both light and dark mode baselines for this story.
      modes: {
        light: { backgrounds: { value: '#ffffff' } },
        dark: { backgrounds: { value: '#1a1a1a' } },
      },
    },
  },
};

/**
 * Insurance Pool panel — flag enabled, loading skeleton state.
 * Captures the async-loading appearance before pool data resolves.
 */
export const FlagEnabledLoading: Story = {
  tags: ['dark-feature', 'chromatic'],
  parameters: {
    env: {
      NEXT_PUBLIC_INSURANCE_POOL_ENABLED: 'true',
    },
    chromatic: {
      // Pause animations so the skeleton renders at a consistent frame.
      pauseAnimationAtEnd: true,
    },
  },
};
