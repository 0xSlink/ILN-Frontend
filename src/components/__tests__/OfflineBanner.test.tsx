import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfflineBanner from '../OfflineBanner';

const { resumePausedMutationsMock, refetchQueriesMock, queryClientMock } = vi.hoisted(() => ({
  resumePausedMutationsMock: vi.fn(),
  refetchQueriesMock: vi.fn(),
  queryClientMock: {} as any,
}));
queryClientMock.resumePausedMutations = resumePausedMutationsMock;
queryClientMock.refetchQueries = refetchQueriesMock;

// useQueryClient must return a referentially stable object across renders -
// OfflineBanner's online/offline effect depends on it, and a fresh object
// per render would tear down and re-run the effect (clearing the pending
// dismiss timer) on every state update.
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => queryClientMock,
}));

const addToastMock = vi.fn();
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, writable: true, configurable: true });
}

describe('OfflineBanner', () => {
  beforeEach(() => {
    resumePausedMutationsMock.mockClear();
    refetchQueriesMock.mockClear();
    addToastMock.mockClear();
    setOnline(true);
    // jsdom doesn't define navigator.serviceWorker at all; delete rather than
    // set to undefined so `'serviceWorker' in navigator` stays false.
    delete (navigator as any).serviceWorker;
  });

  afterEach(() => {
    setOnline(true);
  });

  it('renders nothing while online', () => {
    const { container } = render(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the banner immediately when mounted while offline', () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent("You're offline");
  });

  it('shows the banner when the offline event fires', () => {
    render(<OfflineBanner />);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows a "no offline cache" hint when there is no service worker support', () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByText(/No offline cache/)).toBeInTheDocument();
  });

  it('resumes queries, shows a success toast, and dismisses itself when back online', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await act(async () => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(resumePausedMutationsMock).toHaveBeenCalled();
    expect(refetchQueriesMock).toHaveBeenCalledWith({ type: 'active' });
    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', title: 'Back Online' })
      )
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('dismisses manually via the close button', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setOnline(false);
    render(<OfflineBanner />);

    fireEvent.click(screen.getByLabelText('Dismiss offline banner'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    vi.useRealTimers();
  });

  it('shows the offline-cache-active hint once the service worker is ready', async () => {
    setOnline(false);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({}),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
    render(<OfflineBanner />);
    await waitFor(() => expect(screen.getByText(/Offline cache active/)).toBeInTheDocument());
  });
});
