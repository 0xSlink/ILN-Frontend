import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ScoreSimulator } from '../profile/ScoreSimulator';

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const props = {
  currentPaid: 80,
  currentSubmitted: 100,
  currentDefaulted: 0,
};

describe('ScoreSimulator reduced motion', () => {
  const original = window.matchMedia;
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: original,
    });
  });

  it('shows the projected score immediately without animating when reduced motion is preferred', () => {
    mockReducedMotion(true);
    render(<ScoreSimulator {...props} />);
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('animates from 0 when motion is allowed', () => {
    mockReducedMotion(false);
    render(<ScoreSimulator {...props} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
