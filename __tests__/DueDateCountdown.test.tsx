import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DueDateCountdown from '@/components/DueDateCountdown';

describe('DueDateCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  const now = new Date('2026-04-24T12:00:00Z').getTime() / 1000;

  const renderComponent = (dueDateOffsetSeconds: number, props = {}) => {
    const dueDate = BigInt(Math.floor(now + dueDateOffsetSeconds));
    return render(<DueDateCountdown dueDate={dueDate} {...props} />);
  };

  describe('Time formatting and threshold logic', () => {
    it("displays '> 7 days' format in green for dates more than 7 days away", () => {
      // 10 days in the future = 10 * 24 * 60 * 60 = 864000 seconds
      renderComponent(864000);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('10d 0h');
      expect(countdown).toHaveClass('text-green-500');
      expect(countdown).not.toHaveClass('animate-pulse-fast');
    });

    it("displays '1-7 days' format with orange text for dates 1-7 days away", () => {
      // 5 days in the future = 5 * 24 * 60 * 60 = 432000 seconds
      renderComponent(432000);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('5d 0h');
      expect(countdown).toHaveClass('text-amber-500');
      expect(countdown).not.toHaveClass('animate-pulse-fast');
    });

    it('displays boundary case: exactly 7 days with orange text', () => {
      // Exactly 7 days = 7 * 24 * 60 * 60 = 604800 seconds
      renderComponent(604800);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('7d 0h');
      expect(countdown).toHaveClass('text-amber-500');
      expect(countdown).not.toHaveClass('animate-pulse-fast');
    });

    it('displays boundary case: exactly 1 day with orange text', () => {
      // Exactly 1 day = 24 * 60 * 60 = 86400 seconds
      renderComponent(86400);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('1d 0h');
      expect(countdown).toHaveClass('text-amber-500');
      expect(countdown).not.toHaveClass('animate-pulse-fast');
    });

    it("displays '< 24 hours' format with red text and pulse animation", () => {
      // 12 hours in the future = 12 * 60 * 60 = 43200 seconds
      renderComponent(43200);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('12h 0m');
      expect(countdown).toHaveClass('text-red-500');
      expect(countdown).toHaveClass('animate-pulse-fast');
    });

    it('displays boundary case: exactly 24 hours with orange text (days format)', () => {
      // Exactly 24 hours = 24 * 60 * 60 = 86400 seconds (this is 1 day)
      renderComponent(86400);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('1d 0h');
      expect(countdown).toHaveClass('text-amber-500');
      expect(countdown).not.toHaveClass('animate-pulse-fast');
    });

    it('displays boundary case: just under 24 hours with red text and pulse', () => {
      // 23 hours 59 minutes = 23 * 60 * 60 + 59 * 60 = 86340 seconds
      renderComponent(86340);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('23h 59m');
      expect(countdown).toHaveClass('text-red-500');
      expect(countdown).toHaveClass('animate-pulse-fast');
    });

    it('displays an "Expired" pill when overdue, with no pulse', () => {
      // 2 days overdue = -2 * 24 * 60 * 60 = -172800 seconds
      renderComponent(-172800);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('Expired');
      expect(countdown).toHaveClass('text-gray-600');
      expect(countdown).not.toHaveClass('animate-pulse-fast');
    });

    it('displays "Expired" regardless of how long ago the due date passed', () => {
      // 1 day 5 hours overdue = -(24 + 5) * 60 * 60 = -104400 seconds
      renderComponent(-104400);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('Expired');
      expect(countdown).toHaveClass('text-gray-600');
      expect(countdown).not.toHaveClass('animate-pulse-fast');
    });
  });

  describe('Tooltip', () => {
    it('shows tooltip on mouse enter with exact due date in local timezone', () => {
      const dueDate = BigInt(Math.floor(now + 86400)); // 1 day in future
      render(<DueDateCountdown dueDate={dueDate} />);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      fireEvent.mouseEnter(countdown);

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText('Due Date')).toBeInTheDocument();
    });

    it('hides tooltip on mouse leave', () => {
      const dueDate = BigInt(Math.floor(now + 86400));
      render(<DueDateCountdown dueDate={dueDate} />);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      fireEvent.mouseEnter(countdown);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.mouseLeave(countdown);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('shows tooltip on focus', () => {
      const dueDate = BigInt(Math.floor(now + 86400));
      render(<DueDateCountdown dueDate={dueDate} />);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      fireEvent.focus(countdown);

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('hides tooltip on blur', () => {
      const dueDate = BigInt(Math.floor(now + 86400));
      render(<DueDateCountdown dueDate={dueDate} />);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      fireEvent.focus(countdown);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.blur(countdown);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Claim default button', () => {
    it('does not show claim button when invoice is not overdue', () => {
      const dueDate = BigInt(Math.floor(now + 86400)); // 1 day in future
      const onClaimDefault = vi.fn();

      render(
        <DueDateCountdown
          dueDate={dueDate}
          onClaimDefault={onClaimDefault}
          showClaimButton={true}
        />
      );

      expect(screen.queryByText('Claim default')).not.toBeInTheDocument();
    });

    it('shows claim button when invoice is overdue and showClaimButton is true', () => {
      const dueDate = BigInt(Math.floor(now - 86400)); // 1 day overdue
      const onClaimDefault = vi.fn();

      render(
        <DueDateCountdown
          dueDate={dueDate}
          onClaimDefault={onClaimDefault}
          showClaimButton={true}
        />
      );

      expect(screen.getByText('Claim default')).toBeInTheDocument();
    });

    it('does not show claim button when overdue but showClaimButton is false', () => {
      const dueDate = BigInt(Math.floor(now - 86400)); // 1 day overdue
      const onClaimDefault = vi.fn();

      render(
        <DueDateCountdown
          dueDate={dueDate}
          onClaimDefault={onClaimDefault}
          showClaimButton={false}
        />
      );

      expect(screen.queryByText('Claim default')).not.toBeInTheDocument();
    });

    it('calls onClaimDefault when claim button is clicked', () => {
      const dueDate = BigInt(Math.floor(now - 86400)); // 1 day overdue
      const onClaimDefault = vi.fn();

      render(
        <DueDateCountdown
          dueDate={dueDate}
          onClaimDefault={onClaimDefault}
          showClaimButton={true}
        />
      );

      fireEvent.click(screen.getByText('Claim default'));
      expect(onClaimDefault).toHaveBeenCalledTimes(1);
    });

    it('does not show claim button when onClaimDefault is not provided', () => {
      const dueDate = BigInt(Math.floor(now - 86400)); // 1 day overdue

      render(<DueDateCountdown dueDate={dueDate} showClaimButton={true} />);

      expect(screen.queryByText('Claim default')).not.toBeInTheDocument();
    });
  });

  describe('Timer updates', () => {
    it('updates the display every 60 seconds', () => {
      // Start with 2 hours remaining = 2 * 60 * 60 = 7200 seconds
      const dueDate = BigInt(Math.floor(now + 7200));
      render(<DueDateCountdown dueDate={dueDate} />);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('2h 0m');

      // Fast-forward 60 seconds
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      // Should now show 1h 59m
      expect(countdown).toHaveTextContent('1h 59m');
    });

    it('transitions to overdue when time passes', () => {
      // Start with 30 minutes remaining = 30 * 60 = 1800 seconds
      const dueDate = BigInt(Math.floor(now + 1800));
      render(<DueDateCountdown dueDate={dueDate} />);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('30m');
      expect(countdown).toHaveClass('text-red-500');
      expect(countdown).toHaveClass('animate-pulse-fast');

      // Fast-forward 31 minutes (past due)
      act(() => {
        vi.advanceTimersByTime(31 * 60 * 1000);
      });

      expect(countdown).toHaveTextContent('Expired');
      expect(countdown).toHaveClass('text-gray-600');
      expect(countdown).not.toHaveClass('animate-pulse-fast');
    });

    it('cleans up interval on unmount', () => {
      const dueDate = BigInt(Math.floor(now + 7200));
      const { unmount } = render(<DueDateCountdown dueDate={dueDate} />);

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Edge cases', () => {
    it('handles exactly at due date (0 remaining)', () => {
      const dueDate = BigInt(Math.floor(now));
      render(<DueDateCountdown dueDate={dueDate} />);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      // At exactly 0, it shows 0h 0m (under 24 hours format with pulse)
      expect(countdown).toHaveTextContent('0h 0m');
      expect(countdown).toHaveClass('text-red-500');
      expect(countdown).toHaveClass('animate-pulse-fast');
    });

    it('handles very large future dates', () => {
      // 365 days in the future
      const dueDate = BigInt(Math.floor(now + 365 * 24 * 60 * 60));
      render(<DueDateCountdown dueDate={dueDate} />);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('365d 0h');
      expect(countdown).toHaveClass('text-green-500');
    });

    it('handles minutes display correctly for < 1 hour', () => {
      // 45 minutes in the future
      const dueDate = BigInt(Math.floor(now + 45 * 60));
      render(<DueDateCountdown dueDate={dueDate} />);

      const countdown = screen.getByRole('button', { name: /Due date:/i });
      expect(countdown).toHaveTextContent('0h 45m');
      expect(countdown).toHaveClass('text-red-500');
      expect(countdown).toHaveClass('animate-pulse-fast');
    });
  });
});
