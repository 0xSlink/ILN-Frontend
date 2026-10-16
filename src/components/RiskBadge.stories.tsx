import type { Meta, StoryObj } from '@storybook/react-vite';
import { within, userEvent, expect } from 'storybook/test';
import RiskBadge from './RiskBadge';
import type { PayerScore } from '@/utils/risk';

/**
 * `RiskBadge` shows a payer's on-chain risk level as a coloured pill. Clicking it
 * reveals a tooltip with the underlying payer score, settlement history, and a
 * score bar — or a "no history" message when the payer is unknown.
 */
const meta: Meta<typeof RiskBadge> = {
  title: 'Components/RiskBadge',
  component: RiskBadge,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
  argTypes: {
    risk: {
      description: 'Risk level derived from the payer score.',
      control: { type: 'select' },
      options: ['Low', 'Medium', 'High', 'Unknown'],
    },
    score: {
      description: 'Payer score detail shown in the tooltip; null when unknown.',
      control: { type: 'object' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const lowScore: PayerScore = { score: 82, settled_on_time: 14, defaults: 0 };
const mediumScore: PayerScore = { score: 55, settled_on_time: 7, defaults: 2 };
const highScore: PayerScore = { score: 21, settled_on_time: 2, defaults: 6 };

/** Opens the tooltip so its content is visible (used for Chromatic snapshots). */
const openTooltip: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole('button', { name: /risk level/i });
  await userEvent.click(trigger);
  await expect(await canvas.findByRole('tooltip')).toBeInTheDocument();
};

export const Low: Story = {
  args: { risk: 'Low', score: lowScore },
};

export const Medium: Story = {
  args: { risk: 'Medium', score: mediumScore },
};

export const High: Story = {
  args: { risk: 'High', score: highScore },
};

export const Unknown: Story = {
  args: { risk: 'Unknown', score: null },
};

/** Tooltip variation: a payer with a full on-chain score breakdown. */
export const TooltipWithScore: Story = {
  args: { risk: 'Low', score: lowScore },
  play: openTooltip,
};

/** Tooltip variation: a payer with no on-chain history. */
export const TooltipWithoutHistory: Story = {
  args: { risk: 'Unknown', score: null },
  play: openTooltip,
};

/** All risk levels side by side for quick visual comparison. */
export const AllRiskLevels: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <RiskBadge risk="Low" score={lowScore} />
      <RiskBadge risk="Medium" score={mediumScore} />
      <RiskBadge risk="High" score={highScore} />
      <RiskBadge risk="Unknown" score={null} />
    </div>
  ),
};

/** Dark-theme rendering of every risk level (Chromatic dark variant). */
export const DarkTheme: Story = {
  globals: { theme: 'dark' },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <RiskBadge risk="Low" score={lowScore} />
      <RiskBadge risk="Medium" score={mediumScore} />
      <RiskBadge risk="High" score={highScore} />
      <RiskBadge risk="Unknown" score={null} />
    </div>
  ),
};
