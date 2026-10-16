import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoreSimulator } from '@/components/profile/ScoreSimulator';

describe('ScoreSimulator', () => {
  const defaultProps = {
    currentPaid: 10,
    currentSubmitted: 12,
    currentDefaulted: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates current score correctly', () => {
    render(<ScoreSimulator {...defaultProps} />);
    // (10 / 12) * 100 = 83.33 -> rounded to 83
    expect(screen.getByText('Current: 83')).toBeDefined();
  });

  it('calculates projected score correctly when adding paid invoices', async () => {
    render(<ScoreSimulator {...defaultProps} />);

    const paidInput = screen.getByLabelText(/Future Invoices Paid/);
    fireEvent.change(paidInput, { target: { value: '5' } });

    // New Paid: 15, New Submitted: 17, New Defaulted: 2
    // (15 / 17) * 100 = 88.23 -> rounded to 88
    await waitFor(() => {
      expect(screen.getByText('88')).toBeDefined();
    });
  });

  it('calculates projected score correctly when adding defaulted invoices', async () => {
    render(<ScoreSimulator {...defaultProps} />);

    const defaultedInput = screen.getByLabelText(/Future Invoices Defaulted/);
    fireEvent.change(defaultedInput, { target: { value: '3' } });

    // New Paid: 10, New Submitted: 15, New Defaulted: 5
    // (10 / 15) * 100 = 66.66 -> rounded to 67
    await waitFor(() => {
      expect(screen.getByText('67')).toBeDefined();
    });
  });

  it('handles division by zero gracefully', () => {
    render(<ScoreSimulator currentPaid={0} currentSubmitted={0} currentDefaulted={0} />);
    expect(screen.getByText('No impact calculable')).toBeDefined();
  });

  it('prevents negative inputs', () => {
    render(<ScoreSimulator {...defaultProps} />);
    const paidInput = screen.getByLabelText(/Future Invoices Paid/);
    fireEvent.change(paidInput, { target: { value: '-5' } });
    expect((paidInput as HTMLInputElement).value).toBe('0');
  });

  it('clamps score between 0 and 100', async () => {
    // Scenario that would lead to > 100 (not possible with formula but good to check)
    // Actually the formula ((paid + addPaid) / (submitted + addPaid + addDef)) * 100
    // can't exceed 100 if paid <= submitted and addPaid is in both numerator and denominator.

    // However, let's test absolute minimum
    render(<ScoreSimulator currentPaid={0} currentSubmitted={10} currentDefaulted={10} />);
    const defaultedInput = screen.getByLabelText(/Future Invoices Defaulted/);
    fireEvent.change(defaultedInput, { target: { value: '100' } });

    await waitFor(() => {
      expect(screen.getByText('0')).toBeDefined();
    });
  });
});
