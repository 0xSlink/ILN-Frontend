import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RiskBadge from '../RiskBadge';
import type { PayerScore } from '@/utils/risk';

const score: PayerScore = { score: 72, settled_on_time: 10, defaults: 1 } as PayerScore;

describe('RiskBadge', () => {
  it('renders the risk level label', () => {
    render(<RiskBadge risk="Low" score={score} />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('is closed by default', () => {
    render(<RiskBadge risk="Medium" score={score} />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens details with score breakdown on click', () => {
    render(<RiskBadge risk="High" score={score} />);
    fireEvent.click(screen.getByRole('button'));
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('72/100');
    expect(tooltip).toHaveTextContent('10');
    expect(tooltip).toHaveTextContent('1');
  });

  it('shows a no-history message when there is no score', () => {
    render(<RiskBadge risk="Unknown" score={null} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('No on-chain history found for this payer.')).toBeInTheDocument();
  });

  it('toggles closed when clicked again', () => {
    render(<RiskBadge risk="Low" score={score} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes when clicking outside', () => {
    render(
      <div>
        <RiskBadge risk="Low" score={score} />
        <button>outside</button>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /Risk level: Low/ }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
