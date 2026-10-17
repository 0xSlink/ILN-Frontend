import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RowActionsMenu } from '../RowActionsMenu';

const actions = [
  { label: 'Edit', onClick: vi.fn(), icon: 'edit' },
  { label: 'Delete', onClick: vi.fn() },
];

describe('RowActionsMenu', () => {
  it('is closed by default with a default aria-label', () => {
    render(<RowActionsMenu actions={actions} />);
    expect(screen.getByLabelText('Row actions')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('uses a custom aria-label when provided', () => {
    render(<RowActionsMenu actions={actions} ariaLabel="Invoice actions" />);
    expect(screen.getByLabelText('Invoice actions')).toBeInTheDocument();
  });

  it('opens the menu and lists all actions', () => {
    render(<RowActionsMenu actions={actions} />);
    fireEvent.click(screen.getByLabelText('Row actions'));
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('invokes the action and closes the menu on click', () => {
    const onClick = vi.fn();
    render(<RowActionsMenu actions={[{ label: 'Archive', onClick }]} />);
    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(screen.getByText('Archive'));
    expect(onClick).toHaveBeenCalled();
    expect(screen.queryByText('Archive')).not.toBeInTheDocument();
  });

  it('closes the menu when clicking outside', () => {
    render(
      <div>
        <RowActionsMenu actions={actions} />
        <button>outside</button>
      </div>
    );
    fireEvent.click(screen.getByLabelText('Row actions'));
    expect(screen.getByText('Edit')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger button', () => {
    render(<RowActionsMenu actions={actions} />);
    const trigger = screen.getByLabelText('Row actions');
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('moves focus to the first item on ArrowDown', () => {
    render(<RowActionsMenu actions={actions} />);
    const trigger = screen.getByLabelText('Row actions');
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByText('Edit').closest('button')).toHaveFocus();
  });
});
