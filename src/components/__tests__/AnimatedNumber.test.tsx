/**
 * @file AnimatedNumber.test.tsx
 *
 * Tests for the AnimatedNumber component, which animates numeric values
 * from 0 to a target value using requestAnimationFrame.
 *
 * Test coverage:
 * - Renders with correct initial state
 * - Applies custom formatter function
 * - Respects prefers-reduced-motion preference
 * - Re-animates when value prop changes
 * - Applies custom className
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AnimatedNumber from '../AnimatedNumber';

// ─── Mock requestAnimationFrame ──────────────────────────────────────────────

beforeEach(() => {
  // Mock requestAnimationFrame to use setTimeout
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    return setTimeout(cb, 16) as unknown as number;
  });

  // Mock cancelAnimationFrame
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
    clearTimeout(id);
  });

  // Mock matchMedia for reduced motion (default: no reduced motion)
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }) as unknown as MediaQueryList
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AnimatedNumber', () => {
  it('renders with initial value of 0', () => {
    // The default formatter renders two decimal places (decimals prop, default 2).
    render(<AnimatedNumber value={100} duration={10} />);
    expect(screen.getByTestId('animated-number').textContent).toBe('0.00');
  });

  it('animates to target value after duration', async () => {
    render(<AnimatedNumber value={100} duration={50} />);

    // Wait for animation to complete
    await waitFor(
      () => {
        expect(screen.getByTestId('animated-number').textContent).toBe('100.00');
      },
      { timeout: 500 }
    );
  });

  it('formats large numbers with locale separators', async () => {
    render(<AnimatedNumber value={1247} duration={50} />);

    await waitFor(
      () => {
        expect(screen.getByTestId('animated-number').textContent).toBe('1,247.00');
      },
      { timeout: 500 }
    );
  });

  it('applies custom formatter function', async () => {
    const formatter = vi.fn((v) => `$${v.toFixed(0)}`);
    render(<AnimatedNumber value={500} duration={50} formatter={formatter} />);

    await waitFor(
      () => {
        expect(screen.getByTestId('animated-number').textContent).toBe('$500');
      },
      { timeout: 500 }
    );

    expect(formatter).toHaveBeenCalled();
  });

  it('formats USDC values with $ prefix and M/K suffix', async () => {
    const formatUsdc = (v: number): string => {
      if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
      if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
      return `$${Math.round(v).toLocaleString()}`;
    };

    // Test millions
    const { rerender } = render(
      <AnimatedNumber value={1500000} duration={50} formatter={formatUsdc} />
    );
    await waitFor(
      () => {
        expect(screen.getByTestId('animated-number').textContent).toBe('$1.50M');
      },
      { timeout: 500 }
    );

    // Test thousands
    rerender(<AnimatedNumber value={5000} duration={50} formatter={formatUsdc} />);
    await waitFor(
      () => {
        expect(screen.getByTestId('animated-number').textContent).toBe('$5.0K');
      },
      { timeout: 500 }
    );

    // Test hundreds
    rerender(<AnimatedNumber value={500} duration={50} formatter={formatUsdc} />);
    await waitFor(
      () => {
        expect(screen.getByTestId('animated-number').textContent).toBe('$500');
      },
      { timeout: 500 }
    );
  });

  it('formats percentage values with one decimal place', async () => {
    const formatPercent = (v: number): string => `${v.toFixed(1)}%`;

    render(<AnimatedNumber value={3.2} duration={50} formatter={formatPercent} />);

    await waitFor(
      () => {
        expect(screen.getByTestId('animated-number').textContent).toBe('3.2%');
      },
      { timeout: 500 }
    );
  });

  it('respects prefers-reduced-motion by immediately showing final value', () => {
    // Mock matchMedia to simulate reduced motion preference
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: true, // Simulate reduced motion enabled
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
        }) as unknown as MediaQueryList
    );

    render(<AnimatedNumber value={100} duration={1000} />);

    // Should immediately show final value without animation
    expect(screen.getByTestId('animated-number').textContent).toBe('100.00');
  });

  it('re-animates when value prop changes', async () => {
    const { rerender } = render(<AnimatedNumber value={50} duration={50} />);

    // First animation completes
    await waitFor(
      () => {
        expect(screen.getByTestId('animated-number').textContent).toBe('50.00');
      },
      { timeout: 500 }
    );

    // Change value
    rerender(<AnimatedNumber value={100} duration={50} />);

    // Second animation completes
    await waitFor(
      () => {
        expect(screen.getByTestId('animated-number').textContent).toBe('100.00');
      },
      { timeout: 500 }
    );
  });

  it('applies custom className', () => {
    render(<AnimatedNumber value={100} className="test-class font-bold" />);
    expect(screen.getByTestId('animated-number')).toHaveClass('test-class', 'font-bold');
  });

  it('uses default duration of 1500ms', async () => {
    render(<AnimatedNumber value={100} />);

    // Should start at 0
    expect(screen.getByTestId('animated-number').textContent).toBe('0.00');

    // Wait for default animation to complete (1500ms + buffer)
    await waitFor(
      () => {
        expect(screen.getByTestId('animated-number').textContent).toBe('100.00');
      },
      { timeout: 2000 }
    );
  });
});
