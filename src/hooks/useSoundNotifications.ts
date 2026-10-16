/**
 * useSoundNotifications — Issue #166
 *
 * Opt-in sound notifications using the Web Audio API (no audio files).
 * Tones are generated programmatically via oscillators.
 *
 * - Off by default; toggled via returned `setEnabled`
 * - Two sounds: "success" (pleasant two-tone chime) and "alert" (warning tone)
 * - Volume 0–100 (default 50)
 * - Mute without disabling
 * - Settings persisted in localStorage
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_KEY = 'iln-sound-prefs';

interface SoundPrefs {
  enabled: boolean;
  volume: number; // 0–100
  muted: boolean;
}

function loadPrefs(): SoundPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SoundPrefs;
  } catch {
    // ignore
  }
  return { enabled: false, volume: 50, muted: false };
}

function savePrefs(prefs: SoundPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// ── Tone generation ────────────────────────────────────────────────────────────

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
  startOffset = 0
): void {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + startOffset);
  gainNode.gain.setValueAtTime(gain, ctx.currentTime + startOffset);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
  osc.start(ctx.currentTime + startOffset);
  osc.stop(ctx.currentTime + startOffset + duration);
}

/** Pleasant two-tone chime for positive events (funded, settled). */
function playSuccessChime(ctx: AudioContext, volume: number): void {
  const g = volume / 200; // 0–0.5 range
  playTone(ctx, 880, 0.3, g, 'sine', 0);
  playTone(ctx, 1108.73, 0.4, g * 0.8, 'sine', 0.15);
}

/** Single warning tone for negative events (defaulted, overdue). */
function playAlertTone(ctx: AudioContext, volume: number): void {
  const g = volume / 150;
  playTone(ctx, 440, 0.5, g, 'triangle', 0);
  playTone(ctx, 415.3, 0.4, g * 0.6, 'triangle', 0.25);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export type SoundEvent = 'success' | 'alert';

export interface UseSoundNotificationsReturn {
  enabled: boolean;
  volume: number;
  muted: boolean;
  setEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
  setMuted: (v: boolean) => void;
  playSound: (event: SoundEvent) => void;
}

export function useSoundNotifications(): UseSoundNotificationsReturn {
  const [prefs, setPrefs] = useState<SoundPrefs>(loadPrefs);
  const ctxRef = useRef<AudioContext | null>(null);

  // Persist on change
  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const update = useCallback((patch: Partial<SoundPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const playSound = useCallback(
    (event: SoundEvent) => {
      if (!prefs.enabled || prefs.muted) return;

      // Lazily create AudioContext to comply with browser autoplay policy
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = ctxRef.current;

      if (event === 'success') {
        playSuccessChime(ctx, prefs.volume);
      } else {
        playAlertTone(ctx, prefs.volume);
      }
    },
    [prefs.enabled, prefs.muted, prefs.volume]
  );

  return {
    enabled: prefs.enabled,
    volume: prefs.volume,
    muted: prefs.muted,
    setEnabled: (v) => update({ enabled: v }),
    setVolume: (v) => update({ volume: Math.max(0, Math.min(100, v)) }),
    setMuted: (v) => update({ muted: v }),
    playSound,
  };
}
