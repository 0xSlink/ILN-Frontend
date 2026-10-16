import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SoundNotificationSettings from '../SoundNotificationSettings';

const setEnabledMock = vi.fn();
const setVolumeMock = vi.fn();
const setMutedMock = vi.fn();
const playSoundMock = vi.fn();

const hookState = {
  enabled: true,
  volume: 50,
  muted: false,
  setEnabled: setEnabledMock,
  setVolume: setVolumeMock,
  setMuted: setMutedMock,
  playSound: playSoundMock,
};

vi.mock('@/hooks/useSoundNotifications', () => ({
  useSoundNotifications: () => hookState,
}));

describe('SoundNotificationSettings', () => {
  beforeEach(() => {
    setEnabledMock.mockClear();
    setVolumeMock.mockClear();
    setMutedMock.mockClear();
    playSoundMock.mockClear();
    hookState.enabled = true;
    hookState.volume = 50;
    hookState.muted = false;
  });

  it('renders the current volume and toggle states', () => {
    render(<SoundNotificationSettings />);
    expect(screen.getByText('50%')).toBeInTheDocument();
    const switches = screen.getAllByRole('switch');
    expect(switches[0]).toHaveAttribute('aria-checked', 'true');
    expect(switches[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles enabled off', () => {
    render(<SoundNotificationSettings />);
    fireEvent.click(screen.getAllByRole('switch')[0]);
    expect(setEnabledMock).toHaveBeenCalledWith(false);
  });

  it('toggles muted on', () => {
    render(<SoundNotificationSettings />);
    fireEvent.click(screen.getAllByRole('switch')[1]);
    expect(setMutedMock).toHaveBeenCalledWith(true);
  });

  it('disables the mute switch and volume slider when sounds are disabled', () => {
    hookState.enabled = false;
    render(<SoundNotificationSettings />);
    expect(screen.getAllByRole('switch')[1]).toBeDisabled();
    expect(document.getElementById('sound-volume')).toBeDisabled();
  });

  it('disables the volume slider and preview buttons when muted', () => {
    hookState.muted = true;
    render(<SoundNotificationSettings />);
    expect(document.getElementById('sound-volume')).toBeDisabled();
    expect(screen.getByText('Preview success')).toBeDisabled();
    expect(screen.getByText('Preview alert')).toBeDisabled();
  });

  it('updates the volume via the slider', () => {
    render(<SoundNotificationSettings />);
    fireEvent.change(document.getElementById('sound-volume')!, { target: { value: '80' } });
    expect(setVolumeMock).toHaveBeenCalledWith(80);
  });

  it('plays the success and alert preview sounds', () => {
    render(<SoundNotificationSettings />);
    fireEvent.click(screen.getByText('Preview success'));
    expect(playSoundMock).toHaveBeenCalledWith('success');
    fireEvent.click(screen.getByText('Preview alert'));
    expect(playSoundMock).toHaveBeenCalledWith('alert');
  });
});
