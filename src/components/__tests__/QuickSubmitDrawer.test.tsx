import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuickSubmitDrawer from '../QuickSubmitDrawer';

vi.mock('../SubmitInvoiceForm', () => ({
  default: () => <div data-testid="submit-form" />,
}));

describe('QuickSubmitDrawer', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('renders the dialog hidden (aria-hidden) when closed', () => {
    render(<QuickSubmitDrawer isOpen={false} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
    expect(document.body.style.overflow).toBe('');
  });

  it('shows the dialog and locks body scroll when open', () => {
    render(<QuickSubmitDrawer isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-hidden', 'false');
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByTestId('submit-form')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<QuickSubmitDrawer isOpen onClose={onClose} />);
    fireEvent.click(container.querySelector('[aria-hidden="true"]')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<QuickSubmitDrawer isOpen onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close drawer'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape when open', () => {
    const onClose = vi.fn();
    render(<QuickSubmitDrawer isOpen onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose on Escape when already closed', () => {
    const onClose = vi.fn();
    render(<QuickSubmitDrawer isOpen={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('restores body scroll on unmount', () => {
    const { unmount } = render(<QuickSubmitDrawer isOpen onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
