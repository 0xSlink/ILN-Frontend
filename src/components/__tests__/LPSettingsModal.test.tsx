import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LPSettingsModal from '../LPSettingsModal';

const updateSettingsMock = vi.fn();
const updateNotificationPreferencesMock = vi.fn();
const settingsState = {
  minReputation: 20,
  notificationPreferences: {
    categories: { invoice: true, lp: false, governance: true, reputation: false },
    inAppEnabled: true,
    emailEnabled: false,
    email: '',
  },
};

vi.mock('@/hooks/useLPSettings', () => ({
  useLPSettings: () => ({
    settings: settingsState,
    updateSettings: updateSettingsMock,
    updateNotificationPreferences: updateNotificationPreferencesMock,
  }),
}));

describe('LPSettingsModal', () => {
  beforeEach(() => {
    updateSettingsMock.mockClear();
    updateNotificationPreferencesMock.mockClear();
    settingsState.notificationPreferences.emailEnabled = false;
  });

  it('renders nothing when closed', () => {
    const { container } = render(<LPSettingsModal isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the current minimum reputation value', () => {
    render(<LPSettingsModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('updates the reputation threshold via the slider', () => {
    render(<LPSettingsModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Minimum Reputation Threshold'), {
      target: { value: '50' },
    });
    expect(updateSettingsMock).toHaveBeenCalledWith({ minReputation: 50 });
  });

  it('toggles a notification category checkbox', () => {
    render(<LPSettingsModal isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('lp events').closest('label')!.querySelector('input')!);
    expect(updateNotificationPreferencesMock).toHaveBeenCalledWith({
      categories: { invoice: true, lp: true, governance: true, reputation: false },
    });
  });

  it('toggles in-app notifications', () => {
    render(<LPSettingsModal isOpen onClose={vi.fn()} />);
    fireEvent.click(
      screen.getByText('In-app notifications').closest('label')!.querySelector('input')!
    );
    expect(updateNotificationPreferencesMock).toHaveBeenCalledWith({ inAppEnabled: false });
  });

  it('shows an email input only once email notifications are enabled', () => {
    render(<LPSettingsModal isOpen onClose={vi.fn()} />);
    expect(screen.queryByPlaceholderText('you@example.com')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByText('Email notifications').closest('label')!.querySelector('input')!
    );
    expect(updateNotificationPreferencesMock).toHaveBeenCalledWith({ emailEnabled: true });
  });

  it('updates the email address once the field is shown', () => {
    settingsState.notificationPreferences.emailEnabled = true;
    render(<LPSettingsModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'me@example.com' },
    });
    expect(updateNotificationPreferencesMock).toHaveBeenCalledWith({ email: 'me@example.com' });
  });

  it('calls onClose from the header close button and the Done button', () => {
    const onClose = vi.fn();
    render(<LPSettingsModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('close').closest('button')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
