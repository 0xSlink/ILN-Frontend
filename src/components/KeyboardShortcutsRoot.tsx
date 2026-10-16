'use client';

import { type ReactNode } from 'react';
import { KeyboardShortcutsProvider } from '@/context/KeyboardShortcutsContext';

export default function KeyboardShortcutsRoot({ children }: { children: ReactNode }) {
  return <KeyboardShortcutsProvider>{children}</KeyboardShortcutsProvider>;
}
