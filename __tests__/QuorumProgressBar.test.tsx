import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuorumProgressBar from '@/components/QuorumProgressBar';

describe('QuorumProgressBar', () => {
  it('announces pending quorum progress with accessible values', () => {
    render(<QuorumProgressBar votesCast={40_000} quorumRequired={100_000} />);
    expect(screen.getByText(/Quorum: 40\.0K \/ 100\.0K required \(40%\)/)).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: /quorum progress/i });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100000');
    expect(bar).toHaveAttribute('aria-valuenow', '40000');
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringContaining('40%'));
    // Rendered twice: the visible badge and the sr-only live-region status.
    expect(screen.getAllByText(/Quorum pending/i).length).toBeGreaterThan(0);
  });

  it('announces quorum met with accessible values', () => {
    render(<QuorumProgressBar votesCast={120_000} quorumRequired={100_000} />);
    expect(screen.getByText(/Quorum: 120\.0K \/ 100\.0K required \(100%\)/)).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: /quorum progress/i });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100000');
    expect(bar).toHaveAttribute('aria-valuenow', '100000');
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringContaining('100%'));
    expect(screen.getAllByText(/Quorum met/i).length).toBeGreaterThan(0);
  });

  it('updates label when votes change', () => {
    const { rerender } = render(<QuorumProgressBar votesCast={50_000} quorumRequired={100_000} />);
    expect(screen.getByText(/50\.0K \/ 100\.0K/)).toBeInTheDocument();

    rerender(<QuorumProgressBar votesCast={80_000} quorumRequired={100_000} />);
    expect(screen.getByText(/80\.0K \/ 100\.0K/)).toBeInTheDocument();
  });
});
