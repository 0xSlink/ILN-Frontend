import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import QuorumProgressBar from '../QuorumProgressBar';

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

function getFill(): HTMLElement {
  const bar = screen.getByTestId('quorum-progress-bar').querySelector(
    'div[role="progressbar"] > div'
  ) as HTMLElement;
  return bar;
}

describe('QuorumProgressBar reduced motion', () => {
  const original = window.matchMedia;
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: original,
    });
  });

  it('renders the bar at its final width immediately when reduced motion is preferred', () => {
    mockReducedMotion(true);
    render(<QuorumProgressBar votesCast={50} quorumRequired={100} />);
    expect(getFill().style.width).toBe('50%');
  });

  it('starts collapsed before the mount animation when motion is allowed', () => {
    mockReducedMotion(false);
    render(<QuorumProgressBar votesCast={50} quorumRequired={100} />);
    expect(getFill().style.width).toBe('0%');
  });
});
