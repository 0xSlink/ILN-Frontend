/**
 * SoundNotificationSettings component tests
 *
 * Covers:
 *  - Existing render + toggle/slider/preview coverage
 *  - #862  Edit-save-rerender regression:
 *      toggling enabled, muting, and changing volume call through to the hook
 *      setters, and a re-render with the updated hook values shows the new state.
 */
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

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders the current volume and toggle states', () => {
    render(<SoundNotificationSettings />);
    expect(screen.getByText('50%')).toBeInTheDocument();
    const switches = screen.getAllByRole('switch');
    expect(switches[0]).toHaveAttribute('aria-checked', 'true');
    expect(switches[1]).toHaveAttribute('aria-checked', 'false');
  });

  // ── Toggle interactions ────────────────────────────────────────────────────

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

  // ── Volume slider ──────────────────────────────────────────────────────────

  it('updates the volume via the slider', () => {
    render(<SoundNotificationSettings />);
    fireEvent.change(document.getElementById('sound-volume')!, { target: { value: '80' } });
    expect(setVolumeMock).toHaveBeenCalledWith(80);
  });

  // ── Preview sounds ─────────────────────────────────────────────────────────

  it('plays the success and alert preview sounds', () => {
    render(<SoundNotificationSettings />);
    fireEvent.click(screen.getByText('Preview success'));
    expect(playSoundMock).toHaveBeenCalledWith('success');
    fireEvent.click(screen.getByText('Preview alert'));
    expect(playSoundMock).toHaveBeenCalledWith('alert');
  });

  // ── Edit-save-rerender regression (#862) ──────────────────────────────────
  //
  // The component is a controlled view of the hook state. "Save" happens
  // immediately when the setter is called (no explicit save button).
  // Re-render with updated hook state must reflect the new value in the UI.

  it('rerender: volume change is reflected in the displayed percentage', () => {
    const { rerender } = render(<SoundNotificationSettings />);
    expect(screen.getByText('50%')).toBeInTheDocument();

    // Simulate the hook having persisted the new volume
    hookState.volume = 75;
    rerender(<SoundNotificationSettings />);

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('rerender: enabling sounds is reflected in the switch aria-checked state', () => {
    hookState.enabled = false;
    const { rerender } = render(<SoundNotificationSettings />);
    expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'false');

    // Simulate the hook having persisted enabled=true
    hookState.enabled = true;
    rerender(<SoundNotificationSettings />);

    expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('rerender: muting is reflected in the mute switch aria-checked state', () => {
    const { rerender } = render(<SoundNotificationSettings />);
    expect(screen.getAllByRole('switch')[1]).toHaveAttribute('aria-checked', 'false');

    hookState.muted = true;
    rerender(<SoundNotificationSettings />);

    expect(screen.getAllByRole('switch')[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('rerender: enabling sounds un-disables the mute switch', () => {
    hookState.enabled = false;
    const { rerender } = render(<SoundNotificationSettings />);
    expect(screen.getAllByRole('switch')[1]).toBeDisabled();

    hookState.enabled = true;
    rerender(<SoundNotificationSettings />);

    expect(screen.getAllByRole('switch')[1]).not.toBeDisabled();
  });

  it('volume slider value attribute reflects hook state after rerender', () => {
    const { rerender } = render(<SoundNotificationSettings />);
    expect(document.getElementById('sound-volume')).toHaveValue('50');

    hookState.volume = 30;
    rerender(<SoundNotificationSettings />);

    expect(document.getElementById('sound-volume')).toHaveValue('30');
  });
});
