import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReputationHistoryChart from '../ReputationHistoryChart';
import type { ReputationUpdatedEvent } from '@/utils/reputation-history';

/**
 * recharts' Tooltip formatter/labelFormatter and Line's custom `dot` renderer
 * are only invoked by recharts' own internal rendering/measurement logic,
 * which doesn't run under jsdom (ResponsiveContainer has no real size). We
 * mock recharts to capture the props passed to Tooltip/Line and invoke those
 * callbacks directly, mirroring the react-query config-capture pattern used
 * elsewhere in this suite.
 */
let capturedTooltipProps: any;
let capturedLineProps: any;

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-points={JSON.stringify(data)}>
      {children}
    </div>
  ),
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: (props: any) => {
    capturedTooltipProps = props;
    return null;
  },
  Line: (props: any) => {
    capturedLineProps = props;
    return null;
  },
}));

const now = Math.floor(Date.now() / 1000);

const events: ReputationUpdatedEvent[] = [
  { type: 'ReputationUpdated', score: 80, eventType: 'paid', timestamp: now - 86400 * 5 },
  { type: 'ReputationUpdated', score: 60, eventType: 'defaulted', timestamp: now - 86400 * 2 },
  { type: 'ReputationUpdated', score: 55, eventType: 'decay', timestamp: now - 86400 },
];

const ledgerEvents: ReputationUpdatedEvent[] = [
  { type: 'ReputationUpdated', score: 80, eventType: 'paid', ledger: 1000 },
  { type: 'ReputationUpdated', score: 70, eventType: 'decay', ledger: 2000 },
];

describe('ReputationHistoryChart', () => {
  beforeEach(() => {
    capturedTooltipProps = undefined;
    capturedLineProps = undefined;
  });

  it('shows an empty state when there is not enough history', () => {
    render(<ReputationHistoryChart events={[events[0]]} />);
    expect(screen.getByText('No history available')).toBeInTheDocument();
  });

  it('renders the chart and annotation legend once there is enough history', () => {
    render(<ReputationHistoryChart events={events} />);
    expect(screen.queryByText('No history available')).not.toBeInTheDocument();
    expect(screen.getByText('Payment received')).toBeInTheDocument();
    expect(screen.getByText('Invoice defaulted')).toBeInTheDocument();
    expect(screen.getByText('Score decay')).toBeInTheDocument();
  });

  it('switches the active range on click', () => {
    render(<ReputationHistoryChart events={events} />);
    const thirtyDays = screen.getByText('30 days');
    fireEvent.click(thirtyDays);
    expect(thirtyDays.className).toContain('bg-primary');
  });

  it('toggles annotation visibility', () => {
    render(<ReputationHistoryChart events={events} />);
    const toggle = screen.getByText('Hide annotations');
    fireEvent.click(toggle);
    expect(screen.getByText('Show annotations')).toBeInTheDocument();
    expect(screen.queryByText('Payment received')).not.toBeInTheDocument();
  });

  it('formats the tooltip value and label using event type and ledger', () => {
    render(<ReputationHistoryChart events={ledgerEvents} />);
    fireEvent.click(screen.getByText('All time'));

    expect(capturedTooltipProps.formatter(80, 'score', { payload: { eventType: 'paid' } })).toEqual(
      ['80/100', 'Payment received']
    );

    const label = capturedTooltipProps.labelFormatter('Ledger 1000', [
      { payload: { ledger: 1000, timestamp: 5000 } },
    ]);
    expect(label).toContain('Ledger 1000 ·');
  });

  it('falls back to the raw label when the tooltip has no payload', () => {
    render(<ReputationHistoryChart events={ledgerEvents} />);
    fireEvent.click(screen.getByText('All time'));
    expect(capturedTooltipProps.labelFormatter('some-label', [])).toBe('some-label');
    expect(capturedTooltipProps.labelFormatter('some-label', undefined)).toBe('some-label');
  });

  it('renders a plain date label (no ledger separator) for timestamp-only points', () => {
    render(<ReputationHistoryChart events={events} />);
    const label = capturedTooltipProps.labelFormatter('Jan 1', [
      { payload: { ledger: undefined, timestamp: now } },
    ]);
    expect(label).not.toContain('·');
  });

  it("Line's dot renderer draws a plain circle when annotations are hidden", () => {
    render(<ReputationHistoryChart events={events} />);
    fireEvent.click(screen.getByText('Hide annotations'));

    const dot = capturedLineProps.dot({
      cx: 10,
      cy: 20,
      index: 0,
      payload: { eventType: 'paid' },
    });
    const { container } = render(<>{dot}</>);
    const circle = container.querySelector('circle');
    expect(circle).toHaveAttribute('r', '4');
  });

  it("Line's dot renderer draws a colored, event-typed circle when annotations are shown", () => {
    render(<ReputationHistoryChart events={events} />);

    const dot = capturedLineProps.dot({
      cx: 10,
      cy: 20,
      index: 0,
      payload: { eventType: 'defaulted' },
    });
    const { container } = render(<>{dot}</>);
    const circle = container.querySelector('circle');
    expect(circle).toHaveAttribute('r', '6');
    expect(circle).toHaveAttribute('fill', '#ef4444');
  });

  it('renders nothing from the dot renderer when position data is missing', () => {
    render(<ReputationHistoryChart events={events} />);
    const dot = capturedLineProps.dot({ index: 0, payload: undefined });
    const { container } = render(<>{dot}</>);
    expect(container).toBeEmptyDOMElement();
  });
});
