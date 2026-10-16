import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuickSubmitRoot from '../QuickSubmitRoot';

const closeQuickSubmitMock = vi.fn();
const hookState = { isQuickSubmitOpen: false, closeQuickSubmit: closeQuickSubmitMock };
vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => hookState,
}));

vi.mock('@/components/QuickSubmitDrawer', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="drawer" data-open={String(isOpen)}>
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

describe('QuickSubmitRoot', () => {
  beforeEach(() => {
    hookState.isQuickSubmitOpen = false;
    closeQuickSubmitMock.mockClear();
  });

  it('passes the closed state through to the drawer', () => {
    render(<QuickSubmitRoot />);
    expect(screen.getByTestId('drawer')).toHaveAttribute('data-open', 'false');
  });

  it('passes the open state through to the drawer', () => {
    hookState.isQuickSubmitOpen = true;
    render(<QuickSubmitRoot />);
    expect(screen.getByTestId('drawer')).toHaveAttribute('data-open', 'true');
  });

  it('wires the close callback from the hook', () => {
    render(<QuickSubmitRoot />);
    screen.getByText('close').click();
    expect(closeQuickSubmitMock).toHaveBeenCalled();
  });
});
