import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Toast from '../Toast';
import type { ToastMessage } from '@/context/ToastContext';

function makeToast(overrides: Partial<ToastMessage> = {}): ToastMessage {
  return {
    id: '1',
    type: 'info',
    title: 'Something happened',
    ...overrides,
  };
}

describe('Toast', () => {
  beforeEach(() => {
    delete (navigator as any).vibrate;
  });

  it('renders the title and message', () => {
    render(<Toast toast={makeToast({ message: 'Details here' })} onClose={vi.fn()} />);
    expect(screen.getByText('Something happened')).toBeInTheDocument();
    expect(screen.getByText('Details here')).toBeInTheDocument();
  });

  it('shows a pending spinner icon for pending toasts', () => {
    render(<Toast toast={makeToast({ type: 'pending' })} onClose={vi.fn()} />);
    expect(screen.getByText('sync')).toBeInTheDocument();
  });

  it('shows a success icon for success toasts', () => {
    render(<Toast toast={makeToast({ type: 'success' })} onClose={vi.fn()} />);
    expect(screen.getByText('check_circle')).toBeInTheDocument();
  });

  it('shows an error icon for error toasts', () => {
    render(<Toast toast={makeToast({ type: 'error' })} onClose={vi.fn()} />);
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('links to Stellar Expert when a txHash is present', () => {
    render(<Toast toast={makeToast({ txHash: 'abc123' })} onClose={vi.fn()} />);
    const link = screen.getByText('View on Stellar Expert').closest('a');
    expect(link).toHaveAttribute('href', 'https://stellar.expert/explorer/testnet/tx/abc123');
  });

  it('renders and triggers a custom action', () => {
    const onClick = vi.fn();
    render(<Toast toast={makeToast({ action: { label: 'Undo', onClick } })} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Undo'));
    expect(onClick).toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<Toast toast={makeToast()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close toast'));
    expect(onClose).toHaveBeenCalled();
  });

  it('dismisses on a swipe past the threshold and triggers haptic feedback', () => {
    const onClose = vi.fn();
    const vibrate = vi.fn();
    (navigator as any).vibrate = vibrate;
    const { container } = render(<Toast toast={makeToast()} onClose={onClose} />);
    const el = container.firstElementChild as HTMLElement;
    Object.defineProperty(el, 'offsetWidth', { value: 300, configurable: true });

    fireEvent.touchStart(el, { touches: [{ clientX: 0 }] });
    fireEvent.touchMove(el, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(el);

    expect(vibrate).toHaveBeenCalledWith(50);
    expect(onClose).toHaveBeenCalled();
  });

  it('snaps back without closing on a swipe below the threshold', () => {
    const onClose = vi.fn();
    const { container } = render(<Toast toast={makeToast()} onClose={onClose} />);
    const el = container.firstElementChild as HTMLElement;
    Object.defineProperty(el, 'offsetWidth', { value: 300, configurable: true });

    fireEvent.touchStart(el, { touches: [{ clientX: 0 }] });
    fireEvent.touchMove(el, { touches: [{ clientX: 50 }] });
    fireEvent.touchEnd(el);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores a leftward drag (deltaX <= 0)', () => {
    const { container } = render(<Toast toast={makeToast()} onClose={vi.fn()} />);
    const el = container.firstElementChild as HTMLElement;

    fireEvent.touchStart(el, { touches: [{ clientX: 100 }] });
    fireEvent.touchMove(el, { touches: [{ clientX: 50 }] });
    fireEvent.touchEnd(el);
    // No throw, and the element remains rendered without a translated style.
    expect(el.style.transform).toBe('translateX(0px)');
  });

  it('ignores touchmove/touchend when not currently dragging', () => {
    const { container } = render(<Toast toast={makeToast()} onClose={vi.fn()} />);
    const el = container.firstElementChild as HTMLElement;
    expect(() => {
      fireEvent.touchMove(el, { touches: [{ clientX: 50 }] });
      fireEvent.touchEnd(el);
    }).not.toThrow();
  });

  it('does not vibrate when the Vibration API is unavailable', () => {
    const onClose = vi.fn();
    const { container } = render(<Toast toast={makeToast()} onClose={onClose} />);
    const el = container.firstElementChild as HTMLElement;
    Object.defineProperty(el, 'offsetWidth', { value: 300, configurable: true });

    fireEvent.touchStart(el, { touches: [{ clientX: 0 }] });
    fireEvent.touchMove(el, { touches: [{ clientX: 200 }] });
    expect(() => fireEvent.touchEnd(el)).not.toThrow();
    expect(onClose).toHaveBeenCalled();
  });
});
