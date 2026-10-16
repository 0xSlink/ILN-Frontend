import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LPWidgetLayoutManager from '../LPWidgetLayoutManager';
import type { Widget } from '@/hooks/useLPWidgetLayout';

const widgets: Widget[] = [
  { id: 'w1', label: 'Portfolio', visible: true } as Widget,
  { id: 'w2', label: 'Yield', visible: false } as Widget,
];

describe('LPWidgetLayoutManager', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <LPWidgetLayoutManager
        widgets={widgets}
        onToggleWidget={vi.fn()}
        onReorderWidgets={vi.fn()}
        onResetLayout={vi.fn()}
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each widget with its visibility checkbox state', () => {
    render(
      <LPWidgetLayoutManager
        widgets={widgets}
        onToggleWidget={vi.fn()}
        onReorderWidgets={vi.fn()}
        onResetLayout={vi.fn()}
        isOpen
        onClose={vi.fn()}
      />
    );
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
  });

  it('toggles widget visibility', () => {
    const onToggleWidget = vi.fn();
    render(
      <LPWidgetLayoutManager
        widgets={widgets}
        onToggleWidget={onToggleWidget}
        onReorderWidgets={vi.fn()}
        onResetLayout={vi.fn()}
        isOpen
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(onToggleWidget).toHaveBeenCalledWith('w2');
  });

  it('reorders widgets via drag events', () => {
    const onReorderWidgets = vi.fn();
    render(
      <LPWidgetLayoutManager
        widgets={widgets}
        onToggleWidget={vi.fn()}
        onReorderWidgets={onReorderWidgets}
        onResetLayout={vi.fn()}
        isOpen
        onClose={vi.fn()}
      />
    );
    const rows = screen.getByText('Portfolio').closest('label')!.parentElement!.parentElement!;
    const items = rows.querySelectorAll('[draggable="true"]');

    fireEvent.dragStart(items[0]);
    fireEvent.dragOver(items[1]);
    expect(onReorderWidgets).toHaveBeenCalledWith(0, 1);

    fireEvent.dragEnd(items[1]);
  });

  it('does not reorder when dragging over the same index', () => {
    const onReorderWidgets = vi.fn();
    render(
      <LPWidgetLayoutManager
        widgets={widgets}
        onToggleWidget={vi.fn()}
        onReorderWidgets={onReorderWidgets}
        onResetLayout={vi.fn()}
        isOpen
        onClose={vi.fn()}
      />
    );
    const rows = screen.getByText('Portfolio').closest('label')!.parentElement!.parentElement!;
    const items = rows.querySelectorAll('[draggable="true"]');

    fireEvent.dragStart(items[0]);
    fireEvent.dragOver(items[0]);
    expect(onReorderWidgets).not.toHaveBeenCalled();
  });

  it('calls onResetLayout and onClose from their buttons', () => {
    const onResetLayout = vi.fn();
    const onClose = vi.fn();
    render(
      <LPWidgetLayoutManager
        widgets={widgets}
        onToggleWidget={vi.fn()}
        onReorderWidgets={vi.fn()}
        onResetLayout={onResetLayout}
        isOpen
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByText('Reset to Default'));
    expect(onResetLayout).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Close widget manager'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes when clicking the backdrop but not the dialog panel', () => {
    const onClose = vi.fn();
    render(
      <LPWidgetLayoutManager
        widgets={widgets}
        onToggleWidget={vi.fn()}
        onReorderWidgets={vi.fn()}
        onResetLayout={vi.fn()}
        isOpen
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByText('Widget Layout'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });
});
