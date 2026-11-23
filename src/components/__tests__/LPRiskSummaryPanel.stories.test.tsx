import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import defaultMeta, { WithRisk, NoPositions } from '../LPRiskSummaryPanel.stories';
import LPRiskSummaryPanel from '../LPRiskSummaryPanel';

describe('LPRiskSummaryPanel Storybook Fixtures Isolation', () => {
  it('exports standard Storybook metadata with autodocs and clear mock disclaimer', () => {
    expect(defaultMeta.title).toBe('Components/LPRiskSummaryPanel');
    expect(defaultMeta.component).toBe(LPRiskSummaryPanel);
    expect(defaultMeta.tags).toContain('autodocs');
    expect(defaultMeta.parameters?.docs?.description?.component).toMatch(
      /never be mistaken for live protocol data/i
    );
  });

  it('ensures all story fixture invoices use synthetic IDs and non-live account watermarks', () => {
    const invoices = WithRisk.args?.invoices ?? [];
    expect(invoices.length).toBeGreaterThan(0);

    for (const invoice of invoices) {
      // Synthetic fixture IDs must be outside normal sequence to prevent mistaking for real contracts
      expect(invoice.id).toBeGreaterThanOrEqual(999_990_000n);

      // Account addresses must explicitly carry synthetic non-live fixture watermarks
      expect(invoice.payer).toMatch(/^GMOCK_STORY_FIXTURE/);
      expect(invoice.freelancer).toMatch(/^GMOCK_STORY_FIXTURE/);
      expect(invoice.funder).toMatch(/^GMOCK_STORY_FIXTURE/);
    }
  });

  it('renders WithRisk story accurately with synthetic fixtures', () => {
    const Component = defaultMeta.component as React.ComponentType<any>;
    const { container } = render(<Component {...WithRisk.args} />);

    expect(screen.getByText('Risk Summary')).toBeInTheDocument();
    expect(screen.getByText('Positions at Risk')).toBeInTheDocument();
    expect(screen.getByText('Capital at Risk')).toBeInTheDocument();
    expect(screen.getByText('Disputed Positions')).toBeInTheDocument();
    expect(container).not.toBeEmptyDOMElement();
  });

  it('renders NoPositions story returning empty container when position count is zero', () => {
    const Component = defaultMeta.component as React.ComponentType<any>;
    const { container } = render(<Component {...NoPositions.args} />);

    // LPRiskSummaryPanel returns null when there are no active positions
    expect(container).toBeEmptyDOMElement();
  });
});
