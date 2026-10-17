import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ColumnCustomiser, { type ColumnConfig } from '../ColumnCustomiser';

const allColumns: ColumnConfig[] = [
  { id: 'id', label: 'ID', isMandatory: true },
  { id: 'amount', label: 'Amount' },
  { id: 'status', label: 'Status' },
];

const baseProps = {
  allColumns,
  visibleColumns: ['id', 'amount'],
  columnOrder: ['id', 'amount', 'status'],
  onVisibilityChange: vi.fn(),
  onOrderChange: vi.fn(),
  onReset: vi.fn(),
};

describe('ColumnCustomiser', () => {
  it('is closed by default', () => {
    render(<ColumnCustomiser {...baseProps} />);
    expect(screen.queryByText('Table Columns')).not.toBeInTheDocument();
  });

  it('opens the dropdown and lists columns in order', () => {
    render(<ColumnCustomiser {...baseProps} />);
    fireEvent.click(screen.getByText('Columns'));
    const labels = screen.getAllByText(/^(ID|Amount|Status)$/).map((el) => el.textContent);
    expect(labels).toEqual(['ID', 'Amount', 'Status']);
  });

  it('reflects visibility state via checkboxes and disables mandatory columns', () => {
    render(<ColumnCustomiser {...baseProps} />);
    fireEvent.click(screen.getByText('Columns'));
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[0].disabled).toBe(true);
    expect(checkboxes[2].checked).toBe(false);
  });

  it('toggles a non-mandatory column visibility', () => {
    const onVisibilityChange = vi.fn();
    render(<ColumnCustomiser {...baseProps} onVisibilityChange={onVisibilityChange} />);
    fireEvent.click(screen.getByText('Columns'));
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(onVisibilityChange).toHaveBeenCalledWith('amount', false);
  });

  it('calls onReset', () => {
    const onReset = vi.fn();
    render(<ColumnCustomiser {...baseProps} onReset={onReset} />);
    fireEvent.click(screen.getByText('Columns'));
    fireEvent.click(screen.getByText('Reset to Default'));
    expect(onReset).toHaveBeenCalled();
  });

  it('reorders columns via drag-and-drop', () => {
    const onOrderChange = vi.fn();
    render(<ColumnCustomiser {...baseProps} onOrderChange={onOrderChange} />);
    fireEvent.click(screen.getByText('Columns'));
    const items = document.querySelectorAll('[draggable="true"]');
    const dataTransfer = { effectAllowed: '' };

    fireEvent.dragStart(items[0], { dataTransfer });
    fireEvent.dragOver(items[2], { dataTransfer });
    expect(onOrderChange).toHaveBeenCalledWith(['amount', 'status', 'id']);

    fireEvent.dragEnd(items[2], { dataTransfer });
  });

  it('does not reorder when dragging over the same item', () => {
    const onOrderChange = vi.fn();
    render(<ColumnCustomiser {...baseProps} onOrderChange={onOrderChange} />);
    fireEvent.click(screen.getByText('Columns'));
    const items = document.querySelectorAll('[draggable="true"]');
    const dataTransfer = { effectAllowed: '' };
    fireEvent.dragStart(items[0], { dataTransfer });
    fireEvent.dragOver(items[0], { dataTransfer });
    expect(onOrderChange).not.toHaveBeenCalled();
  });

  it('closes when clicking outside', () => {
    render(
      <div>
        <ColumnCustomiser {...baseProps} />
        <button>outside</button>
      </div>
    );
    fireEvent.click(screen.getByText('Columns'));
    expect(screen.getByText('Table Columns')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByText('Table Columns')).not.toBeInTheDocument();
  });

  it('skips rendering a column id that is not found in allColumns', () => {
    render(<ColumnCustomiser {...baseProps} columnOrder={['id', 'amount', 'status', 'ghost']} />);
    fireEvent.click(screen.getByText('Columns'));
    expect(screen.queryByText('ghost')).not.toBeInTheDocument();
  });
});
