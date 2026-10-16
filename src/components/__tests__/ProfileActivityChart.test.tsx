import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileActivityChart from '../ProfileActivityChart';

const data = Array.from({ length: 100 }, (_, i) => ({
  period: `Day ${i + 1}`,
  submissions: i,
  funding: i * 2,
  payments: i * 3,
}));

describe('ProfileActivityChart', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  it('renders nothing when there is no data', () => {
    const { container } = render(<ProfileActivityChart data={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the chart header and range/type controls', () => {
    render(<ProfileActivityChart data={data} />);
    expect(screen.getByText('Activity History')).toBeInTheDocument();
    expect(screen.getByText('7 Days')).toBeInTheDocument();
    expect(screen.getByText('30 Days')).toBeInTheDocument();
    expect(screen.getByText('All Activity')).toBeInTheDocument();
  });

  it('switches the active time range on click', () => {
    render(<ProfileActivityChart data={data} />);
    const sevenDays = screen.getByText('7 Days');
    fireEvent.click(sevenDays);
    expect(sevenDays.className).toContain('bg-primary');
  });

  it('switches the active activity type on click', () => {
    render(<ProfileActivityChart data={data} />);
    const submissionsBtn = screen.getByText('Submissions');
    fireEvent.click(submissionsBtn);
    expect(submissionsBtn.className).toContain('bg-primary');
  });

  it('does not throw when exporting without a resolvable chart SVG', () => {
    render(<ProfileActivityChart data={data} />);
    expect(() => fireEvent.click(screen.getByText('Export'))).not.toThrow();
  });
});
