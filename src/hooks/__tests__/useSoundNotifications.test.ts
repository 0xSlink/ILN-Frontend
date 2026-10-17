/**
 * Tests for useSoundNotifications — Issue #166
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSoundNotifications } from '../useSoundNotifications';

// Minimal AudioContext stub
class MockOscillator {
  type = 'sine';
  frequency = { setValueAtTime: vi.fn() };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockGainNode {
  gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  connect = vi.fn();
}

class MockAudioContext {
  currentTime = 0;
  destination = {};
  createOscillator = () => new MockOscillator();
  createGain = () => new MockGainNode();
}

// @ts-expect-error — override for tests
global.AudioContext = MockAudioContext;

describe('useSoundNotifications (#166)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('is disabled by default', () => {
    const { result } = renderHook(() => useSoundNotifications());
    expect(result.current.enabled).toBe(false);
  });

  test('setEnabled toggles the enabled flag', () => {
    const { result } = renderHook(() => useSoundNotifications());
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
  });

  test('persists enabled state to localStorage', () => {
    const { result } = renderHook(() => useSoundNotifications());
    act(() => result.current.setEnabled(true));
    const stored = JSON.parse(localStorage.getItem('iln-sound-prefs') ?? '{}');
    expect(stored.enabled).toBe(true);
  });

  test('default volume is 50', () => {
    const { result } = renderHook(() => useSoundNotifications());
    expect(result.current.volume).toBe(50);
  });

  test('setVolume clamps to 0–100', () => {
    const { result } = renderHook(() => useSoundNotifications());
    act(() => result.current.setVolume(150));
    expect(result.current.volume).toBe(100);
    act(() => result.current.setVolume(-10));
    expect(result.current.volume).toBe(0);
  });

  test('setMuted mutes without disabling', () => {
    const { result } = renderHook(() => useSoundNotifications());
    act(() => result.current.setEnabled(true));
    act(() => result.current.setMuted(true));
    expect(result.current.muted).toBe(true);
    expect(result.current.enabled).toBe(true);
  });

  test('playSound does nothing when disabled', () => {
    const { result } = renderHook(() => useSoundNotifications());
    // enabled = false by default — should not throw
    expect(() => act(() => result.current.playSound('success'))).not.toThrow();
  });

  test('playSound does nothing when muted', () => {
    const { result } = renderHook(() => useSoundNotifications());
    act(() => result.current.setEnabled(true));
    act(() => result.current.setMuted(true));
    expect(() => act(() => result.current.playSound('alert'))).not.toThrow();
  });

  test('persists muted state to localStorage', () => {
    const { result } = renderHook(() => useSoundNotifications());
    act(() => result.current.setMuted(true));
    const stored = JSON.parse(localStorage.getItem('iln-sound-prefs') ?? '{}');
    expect(stored.muted).toBe(true);
  });

  test('loads previously saved preferences', () => {
    localStorage.setItem(
      'iln-sound-prefs',
      JSON.stringify({ enabled: true, volume: 75, muted: true })
    );
    const { result } = renderHook(() => useSoundNotifications());
    expect(result.current.enabled).toBe(true);
    expect(result.current.volume).toBe(75);
    expect(result.current.muted).toBe(true);
  });

  test('falls back to defaults when stored preferences are corrupt JSON', () => {
    localStorage.setItem('iln-sound-prefs', '{not-json');
    const { result } = renderHook(() => useSoundNotifications());
    expect(result.current.enabled).toBe(false);
    expect(result.current.volume).toBe(50);
  });

  test('playSound generates a success chime (two tones) when enabled and unmuted', () => {
    const createOscillator = vi.fn(() => new MockOscillator());
    const createGain = vi.fn(() => new MockGainNode());
    // @ts-expect-error — override for this test
    global.AudioContext = class {
      currentTime = 0;
      destination = {};
      createOscillator = createOscillator;
      createGain = createGain;
    };

    const { result } = renderHook(() => useSoundNotifications());
    act(() => result.current.setEnabled(true));
    act(() => result.current.playSound('success'));

    // Success chime plays two tones (two oscillator/gain pairs).
    expect(createOscillator).toHaveBeenCalledTimes(2);
    expect(createGain).toHaveBeenCalledTimes(2);
  });

  test('playSound generates an alert tone (two tones) when enabled and unmuted', () => {
    const createOscillator = vi.fn(() => new MockOscillator());
    const createGain = vi.fn(() => new MockGainNode());
    // @ts-expect-error — override for this test
    global.AudioContext = class {
      currentTime = 0;
      destination = {};
      createOscillator = createOscillator;
      createGain = createGain;
    };

    const { result } = renderHook(() => useSoundNotifications());
    act(() => result.current.setEnabled(true));
    act(() => result.current.playSound('alert'));

    expect(createOscillator).toHaveBeenCalledTimes(2);
    expect(createGain).toHaveBeenCalledTimes(2);
  });

  test('reuses the same AudioContext across multiple playSound calls', () => {
    const audioContextSpy = vi.fn(function (this: any) {
      this.currentTime = 0;
      this.destination = {};
      this.createOscillator = () => new MockOscillator();
      this.createGain = () => new MockGainNode();
    });
    // @ts-expect-error — override for this test
    global.AudioContext = audioContextSpy;

    const { result } = renderHook(() => useSoundNotifications());
    act(() => result.current.setEnabled(true));
    act(() => result.current.playSound('success'));
    act(() => result.current.playSound('alert'));

    expect(audioContextSpy).toHaveBeenCalledTimes(1);
  });

  test('falls back to webkitAudioContext when AudioContext is unavailable', () => {
    const webkitCreateOscillator = vi.fn(() => new MockOscillator());
    const webkitCreateGain = vi.fn(() => new MockGainNode());
    // @ts-expect-error — simulate a Safari-style environment for this test
    delete global.AudioContext;
    // @ts-expect-error — override for this test
    (window as any).webkitAudioContext = class {
      currentTime = 0;
      destination = {};
      createOscillator = webkitCreateOscillator;
      createGain = webkitCreateGain;
    };

    const { result } = renderHook(() => useSoundNotifications());
    act(() => result.current.setEnabled(true));
    act(() => result.current.playSound('success'));

    expect(webkitCreateOscillator).toHaveBeenCalled();

    global.AudioContext = MockAudioContext as any;
    delete (window as any).webkitAudioContext;
  });
});
