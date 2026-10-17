import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Toast rendering is delegated to Sonner; ToastContext's job is to translate the
// app's toast shape into the right Sonner call (and to announce it for a11y).
const { sonnerToast } = vi.hoisted(() => ({
  sonnerToast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: sonnerToast,
  Toaster: () => null,
}));

import { ToastProvider, useToast } from '@/context/ToastContext';
import { TOAST_AUTO_DISMISS_MS } from '@/lib/toast-config';

function TestComponent() {
  const { addToast, updateToast, removeToast } = useToast();

  return (
    <div>
      <button
        onClick={() => {
          const id = addToast({ type: 'pending', title: 'Submitting tx...' });
          updateToast(id, { type: 'success', title: 'Tx Confirmed', txHash: '0x123abc' });
        }}
      >
        Submit Tx
      </button>
      <button
        onClick={() => addToast({ type: 'error', title: 'Tx Failed', message: 'User rejected' })}
      >
        Fail Tx
      </button>
      <button onClick={() => removeToast('toast-1')}>Dismiss</button>
    </div>
  );
}

function renderToasts() {
  return render(
    <ToastProvider>
      <TestComponent />
    </ToastProvider>
  );
}

describe('Toast System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show a pending toast and then update the same toast to success', () => {
    renderToasts();

    fireEvent.click(screen.getByText('Submit Tx'));

    expect(sonnerToast.loading).toHaveBeenCalledWith(
      'Submitting tx...',
      expect.objectContaining({ duration: Infinity })
    );

    const pendingId = sonnerToast.loading.mock.calls[0][1].id;
    expect(sonnerToast.success).toHaveBeenCalledWith(
      'Tx Confirmed',
      expect.objectContaining({ id: pendingId, description: 'Tx: 0x123abc…' })
    );
  });

  it('should render an error toast with a message and no auto-dismiss', () => {
    renderToasts();

    fireEvent.click(screen.getByText('Fail Tx'));

    expect(sonnerToast.error).toHaveBeenCalledWith(
      'Tx Failed',
      expect.objectContaining({ description: 'User rejected', duration: Infinity })
    );
  });

  it('should hand non-blocking toasts to Sonner with the shared auto-dismiss duration', () => {
    renderToasts();

    fireEvent.click(screen.getByText('Submit Tx'));

    expect(sonnerToast.success).toHaveBeenCalledWith(
      'Tx Confirmed',
      expect.objectContaining({ duration: TOAST_AUTO_DISMISS_MS })
    );
  });

  it('should dismiss a toast by id', () => {
    renderToasts();

    fireEvent.click(screen.getByText('Dismiss'));

    expect(sonnerToast.dismiss).toHaveBeenCalledWith('toast-1');
  });

  it('should announce toasts in the polite live region', () => {
    vi.useFakeTimers();
    renderToasts();

    fireEvent.click(screen.getByText('Fail Tx'));

    const liveRegion = document.getElementById('toast-live-region');
    expect(liveRegion).toHaveTextContent('Tx Failed. User rejected');

    // The announcement is cleared once screen readers have had time to read it.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(liveRegion).toHaveTextContent('');
  });
});
