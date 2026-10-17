import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FABProvider from '../FABProvider';

const usePathnameMock = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock('../FloatingActionButton', () => ({
  default: ({ visible }: { visible: boolean }) => (
    <div data-testid="fab" data-visible={String(visible)} />
  ),
}));

describe('FABProvider', () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
  });

  it('hides the FAB on the submit route', () => {
    usePathnameMock.mockReturnValue('/submit');
    render(<FABProvider />);
    expect(screen.getByTestId('fab')).toHaveAttribute('data-visible', 'false');
  });

  it('hides the FAB on the home route', () => {
    usePathnameMock.mockReturnValue('/');
    render(<FABProvider />);
    expect(screen.getByTestId('fab')).toHaveAttribute('data-visible', 'false');
  });

  it('shows the FAB on other routes', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    render(<FABProvider />);
    expect(screen.getByTestId('fab')).toHaveAttribute('data-visible', 'true');
  });
});
