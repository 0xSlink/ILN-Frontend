import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import VotingProgressBar from '../VotingProgressBar';
import React from 'react';

describe('VotingProgressBar', () => {
  const defaultProps = {
    for: 60,
    against: 40,
    quorum: 80,
    totalEligible: 1000,
  };

  it('calculates and displays percentages correctly', () => {
    render(<VotingProgressBar {...defaultProps} />);
    // Total cast = 100. For = 60%, Against = 40%
    expect(screen.getByText('(60.0%)')).toBeInTheDocument();
    expect(screen.getByText('(40.0%)')).toBeInTheDocument();
  });

  it('indicates when quorum is reached', () => {
    // Total cast = 100, quorum = 80 -> Reached
    render(<VotingProgressBar {...defaultProps} />);
    expect(screen.getByText(/Quorum Reached/i)).toBeInTheDocument();
  });

  it('indicates when quorum is not reached', () => {
    // Total cast = 100, quorum = 120 -> Not reached
    render(<VotingProgressBar {...defaultProps} quorum={120} />);
    expect(screen.getByText(/Quorum Not Reached/i)).toBeInTheDocument();
  });

  it('handles 0 votes correctly (no division by zero)', () => {
    render(<VotingProgressBar for={0} against={0} quorum={100} totalEligible={1000} />);
    expect(screen.getByText('Total Cast')).toBeInTheDocument();
    const pctDisplays = screen.getAllByText('(0.0%)');
    expect(pctDisplays.length).toBe(2);
  });

  it('handles 100% in one category', () => {
    render(<VotingProgressBar for={100} against={0} quorum={50} totalEligible={1000} />);
    expect(screen.getByText('(100.0%)')).toBeInTheDocument();
  });

  it('shows totals correctly', () => {
    render(<VotingProgressBar {...defaultProps} />);
    expect(screen.getByText('100')).toBeInTheDocument(); // totalVotesCast
    expect(screen.getByText('1,000')).toBeInTheDocument(); // totalEligible
  });
});
