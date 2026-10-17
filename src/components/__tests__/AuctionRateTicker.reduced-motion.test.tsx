import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import AuctionRateTicker from '../AuctionRateTicker';

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

const defaultProps = {
  startRate: 1000,
  minRate: 500,
  auctionStartTime: Math.floor(Date.now() / 1000) - 10,
  auctionDurationSeconds: 3600,
};

describe('AuctionRateTicker reduced motion', () => {
  const original = window.matchMedia;
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: original,
    });
  });

  it('renders a static snapshot and does not start a ticking interval when reduced motion is preferred', () => {
    mockReducedMotion(true);
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    render(<AuctionRateTicker {...defaultProps} />);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('auction-rate-ticker')).toBeInTheDocument();
    expect(screen.getByTestId('current-rate').textContent).toContain('bps');
    setIntervalSpy.mockRestore();
  });

  it('starts a live ticking interval when motion is allowed', () => {
    mockReducedMotion(false);
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    render(<AuctionRateTicker {...defaultProps} />);
    expect(setIntervalSpy).toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
