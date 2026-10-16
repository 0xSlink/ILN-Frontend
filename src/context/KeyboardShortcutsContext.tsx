'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || element.isContentEditable;
}

interface KeyboardShortcutsContextValue {
  isShortcutsOpen: boolean;
  openShortcuts: () => void;
  closeShortcuts: () => void;
  isQuickSubmitOpen: boolean;
  openQuickSubmit: () => void;
  closeQuickSubmit: () => void;
  registerToggleCommandPalette: (callback: () => void) => () => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isQuickSubmitOpen, setIsQuickSubmitOpen] = useState(false);
  const commandPaletteToggleRef = useRef<(() => void) | null>(null);

  const openShortcuts = useCallback(() => setIsShortcutsOpen(true), []);
  const closeShortcuts = useCallback(() => setIsShortcutsOpen(false), []);
  const openQuickSubmit = useCallback(() => setIsQuickSubmitOpen(true), []);
  const closeQuickSubmit = useCallback(() => setIsQuickSubmitOpen(false), []);

  const registerToggleCommandPalette = useCallback((callback: () => void) => {
    commandPaletteToggleRef.current = callback;
    return () => {
      if (commandPaletteToggleRef.current === callback) {
        commandPaletteToggleRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isShortcutsOpen) {
          event.preventDefault();
          closeShortcuts();
        }
        return;
      }

      if (isTypingTarget(event.target)) return;

      const isMeta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (isMeta && key === 'k') {
        event.preventDefault();
        commandPaletteToggleRef.current?.();
        return;
      }

      if (isMeta && key === 'n') {
        event.preventDefault();
        openQuickSubmit();
        return;
      }

      if (isMeta && (event.key === '/' || event.key === '?')) {
        event.preventDefault();
        openShortcuts();
        return;
      }

      if (!isMeta && event.key === '?') {
        event.preventDefault();
        openShortcuts();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isShortcutsOpen, closeShortcuts, openQuickSubmit, openShortcuts]);

  const value = useMemo(
    () => ({
      isShortcutsOpen,
      openShortcuts,
      closeShortcuts,
      isQuickSubmitOpen,
      openQuickSubmit,
      closeQuickSubmit,
      registerToggleCommandPalette,
    }),
    [
      isShortcutsOpen,
      closeShortcuts,
      closeQuickSubmit,
      openQuickSubmit,
      openShortcuts,
      registerToggleCommandPalette,
    ]
  );

  return (
    <KeyboardShortcutsContext.Provider value={value}>{children}</KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within a KeyboardShortcutsProvider');
  }
  return context;
}
