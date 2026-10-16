import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PayerReminderOptIn from '../PayerReminderOptIn';

const walletState = { address: 'GADDR' as string | null, isConnected: true };
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

const addToastMock = vi.fn();
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

const fetchMock = vi.fn();

describe('PayerReminderOptIn', () => {
  beforeEach(() => {
    walletState.address = 'GADDR';
    walletState.isConnected = true;
    addToastMock.mockClear();
    fromMock.mockClear();
    selectMock.mockClear();
    eqMock.mockClear();
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: null });
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('renders nothing when the wallet is not connected', () => {
    walletState.isConnected = false;
    const { container } = render(<PayerReminderOptIn />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a loading skeleton while the preference loads', () => {
    maybeSingleMock.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PayerReminderOptIn />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('populates the form from a saved preference', async () => {
    maybeSingleMock.mockResolvedValue({ data: { email: 'me@example.com', enabled: true } });
    render(<PayerReminderOptIn />);

    await waitFor(() =>
      expect(screen.getByPlaceholderText('your@email.com')).toHaveValue('me@example.com')
    );
    expect(screen.getByText('Reminders enabled')).toBeInTheDocument();
    expect(fromMock).toHaveBeenCalledWith('reminder_preferences');
    expect(eqMock).toHaveBeenCalledWith('address', 'GADDR');
  });

  it('logs and stops loading when the preference fetch throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    maybeSingleMock.mockRejectedValue(new Error('db down'));
    render(<PayerReminderOptIn />);

    await waitFor(() => expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument());
    expect(consoleSpy).toHaveBeenCalledWith('Error loading preference:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('toggles the enabled switch', async () => {
    render(<PayerReminderOptIn />);
    await screen.findByPlaceholderText('your@email.com');

    expect(screen.getByText('Reminders disabled')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(screen.getByText('Reminders enabled')).toBeInTheDocument();
  });

  it('disables the save button until an email is entered', async () => {
    render(<PayerReminderOptIn />);
    await screen.findByPlaceholderText('your@email.com');
    expect(screen.getByText('Save Preferences')).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    expect(screen.getByText('Save Preferences')).not.toBeDisabled();
  });

  it('saves preferences and shows a success toast', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(<PayerReminderOptIn />);
    await screen.findByPlaceholderText('your@email.com');

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByText('Save Preferences'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/reminders',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ address: 'GADDR', email: 'me@example.com', enabled: false }),
        })
      )
    );
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Preferences saved' })
    );
  });

  it('shows an error toast when saving fails', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    render(<PayerReminderOptIn />);
    await screen.findByPlaceholderText('your@email.com');

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByText('Save Preferences'));

    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', title: 'Save failed' })
      )
    );
  });

  it('does nothing on submit when there is no connected address', async () => {
    render(<PayerReminderOptIn />);
    await screen.findByPlaceholderText('your@email.com');
    walletState.address = null;

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByText('Save Preferences'));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
