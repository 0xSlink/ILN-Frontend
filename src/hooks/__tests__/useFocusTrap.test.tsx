import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFocusTrap } from '../useFocusTrap';

function TrapHarness({ isActive, onEscape }: { isActive: boolean; onEscape?: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(isActive, onEscape);
  return (
    <div>
      <button data-testid="outside-before">Outside before</button>
      <div ref={ref} data-testid="trap">
        <button data-testid="first">First</button>
        <button data-testid="middle">Middle</button>
        <button data-testid="last">Last</button>
      </div>
      <button data-testid="outside-after">Outside after</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('focuses the first focusable element when activated', () => {
    render(<TrapHarness isActive />);
    expect(screen.getByTestId('first')).toHaveFocus();
  });

  it('does nothing when inactive', () => {
    render(<TrapHarness isActive={false} />);
    expect(document.body).toHaveFocus();
  });

  it('wraps Tab from the last element back to the first', () => {
    render(<TrapHarness isActive />);
    screen.getByTestId('last').focus();

    fireEvent.keyDown(screen.getByTestId('trap'), { key: 'Tab' });
    expect(screen.getByTestId('first')).toHaveFocus();
  });

  it('wraps Shift+Tab from the first element back to the last', () => {
    render(<TrapHarness isActive />);
    expect(screen.getByTestId('first')).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId('trap'), { key: 'Tab', shiftKey: true });
    expect(screen.getByTestId('last')).toHaveFocus();
  });

  it('does not interfere with Tab from a middle element', () => {
    render(<TrapHarness isActive />);
    screen.getByTestId('middle').focus();

    fireEvent.keyDown(screen.getByTestId('trap'), { key: 'Tab' });
    // No wrap should occur; focus stays wherever the browser's default tab
    // order would take it (jsdom doesn't move focus itself), so it remains
    // on the middle element rather than jumping to first/last.
    expect(screen.getByTestId('middle')).toHaveFocus();
  });

  it('calls onEscape when Escape is pressed', () => {
    const onEscape = vi.fn();
    render(<TrapHarness isActive onEscape={onEscape} />);

    fireEvent.keyDown(screen.getByTestId('trap'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalled();
  });

  it('restores focus to the previously active element when deactivated', () => {
    function ToggleHarness() {
      const [active, setActive] = React.useState(false);
      const ref = useFocusTrap<HTMLDivElement>(active);
      return (
        <div>
          <button data-testid="trigger" onClick={() => setActive(true)}>
            Open
          </button>
          {active && (
            <div ref={ref} data-testid="trap">
              <button data-testid="inside">Inside</button>
            </div>
          )}
          <button data-testid="close" onClick={() => setActive(false)}>
            Close
          </button>
        </div>
      );
    }

    render(<ToggleHarness />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    expect(screen.getByTestId('inside')).toHaveFocus();

    fireEvent.click(screen.getByTestId('close'));
    expect(trigger).toHaveFocus();
  });
});
