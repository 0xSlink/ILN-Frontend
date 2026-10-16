import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import OfflineBanner from '@/components/OfflineBanner';

// Both of these must keep a stable identity: OfflineBanner's connection effect
// depends on them and would otherwise re-run (and re-show the banner) on every
// render, undoing the dismissal.
vi.mock('@/context/ToastContext', () => {
  const toast = { addToast: vi.fn(() => 'toast-id'), updateToast: vi.fn() };
  return { useToast: () => toast };
});

vi.mock('@tanstack/react-query', () => {
  const queryClient = {
    resumePausedMutations: vi.fn(),
    refetchQueries: vi.fn(),
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    cancelQueries: vi.fn(),
  };
  return { useQueryClient: () => queryClient };
});

// Mock navigator.onLine
const mockNavigator = {
  onLine: true,
};

Object.defineProperty(window, 'navigator', {
  value: mockNavigator,
  writable: true,
});

describe('OfflineBanner', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    mockNavigator.onLine = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not render when online', () => {
    mockNavigator.onLine = true;
    render(<OfflineBanner />);

    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument();
  });

  it('should render when offline', () => {
    mockNavigator.onLine = false;
    render(<OfflineBanner />);

    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    expect(screen.getByText(/some features may not be available/i)).toBeInTheDocument();
  });

  it('should add event listeners for online/offline events', () => {
    render(<OfflineBanner />);

    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('should remove event listeners on unmount', () => {
    const { unmount } = render(<OfflineBanner />);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('should hide banner when dismissed', async () => {
    mockNavigator.onLine = false;
    render(<OfflineBanner />);

    const dismissButton = screen.getByLabelText(/dismiss offline banner/i);
    fireEvent.click(dismissButton);

    // Dismissal plays an exit animation before the banner unmounts.
    await waitFor(() => expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument());
  });

  it('should show banner again when going offline after being online', () => {
    mockNavigator.onLine = false;
    const { rerender } = render(<OfflineBanner />);

    // Dismiss the banner
    const dismissButton = screen.getByLabelText(/dismiss offline banner/i);
    fireEvent.click(dismissButton);

    // Simulate going online
    mockNavigator.onLine = true;
    rerender(<OfflineBanner />);

    // Simulate going offline again
    mockNavigator.onLine = false;
    rerender(<OfflineBanner />);

    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
  });
});
