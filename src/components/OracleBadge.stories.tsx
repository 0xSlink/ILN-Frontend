import type { Meta, StoryObj } from '@storybook/react-vite';
import OracleBadge from './OracleBadge';

const meta: Meta<typeof OracleBadge> = {
  title: 'Components/OracleBadge',
  component: OracleBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    verified: { control: 'boolean' },
    registryState: {
      control: {
        type: 'select',
        options: ['healthy', 'circuit_tripped', 'data_stale', 'unconfigured'],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Verified: Story = {
  args: {
    verified: true,
    registryState: 'healthy',
  },
};

export const Unverified: Story = {
  args: {
    verified: false,
    registryState: 'healthy',
  },
};

export const CircuitTripped: Story = {
  args: {
    verified: true,
    registryState: 'circuit_tripped',
  },
};

export const DataStale: Story = {
  args: {
    verified: false,
    registryState: 'data_stale',
  },
};

export const Unconfigured: Story = {
  args: {
    verified: false,
    registryState: 'unconfigured',
  },
};

// ── Dark-feature visual regression baselines (Closes #41) ────────────────────
//
// The stories below capture the Oracle Badge UI with the feature flag FORCED ON
// so that Chromatic can establish a visual baseline for all badge states in the
// enabled environment.
//
// Tagged `dark-feature` for selective targeting in the visual regression
// workflow. The `env` parameter override forces the component to render
// regardless of the build-time NEXT_PUBLIC_ORACLE_ENABLED value.

const flagEnabledParameters = {
  env: { NEXT_PUBLIC_ORACLE_ENABLED: 'true' },
  chromatic: {
    modes: {
      light: { backgrounds: { value: '#ffffff' } },
      dark: { backgrounds: { value: '#1a1a1a' } },
    },
  },
};

/**
 * Oracle Badge — flag enabled, healthy verified state.
 * Primary visual baseline (Chromatic).
 */
export const FlagEnabledVerified: Story = {
  tags: ['dark-feature', 'chromatic'],
  args: { verified: true, registryState: 'healthy' },
  parameters: flagEnabledParameters,
};

/**
 * Oracle Badge — flag enabled, healthy unverified state.
 */
export const FlagEnabledUnverified: Story = {
  tags: ['dark-feature', 'chromatic'],
  args: { verified: false, registryState: 'healthy' },
  parameters: flagEnabledParameters,
};

/**
 * Oracle Badge — flag enabled, circuit breaker open.
 * Captures the amber "Verification Unavailable" degraded state.
 */
export const FlagEnabledCircuitTripped: Story = {
  tags: ['dark-feature', 'chromatic'],
  args: { verified: true, registryState: 'circuit_tripped' },
  parameters: flagEnabledParameters,
};

/**
 * Oracle Badge — flag enabled, data stale.
 * Captures the orange "Oracle Data Stale" warning state.
 */
export const FlagEnabledDataStale: Story = {
  tags: ['dark-feature', 'chromatic'],
  args: { verified: false, registryState: 'data_stale' },
  parameters: flagEnabledParameters,
};

/**
 * Oracle Badge — flag enabled, oracle unconfigured.
 * Captures the neutral "Oracle Not Configured" informational state.
 */
export const FlagEnabledUnconfigured: Story = {
  tags: ['dark-feature', 'chromatic'],
  args: { verified: false, registryState: 'unconfigured' },
  parameters: flagEnabledParameters,
};
