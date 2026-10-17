'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import ShortcutsModal from './ShortcutsModal';

export default function CommandPalette() {
  const { isShortcutsOpen, openShortcuts, closeShortcuts, registerToggleCommandPalette } =
    useKeyboardShortcuts();
  const { isOpen, query, setQuery, commands, executeCommand, close, toggle, clearHistory } =
    useCommandPalette(openShortcuts);

  useEffect(() => {
    const unregister = registerToggleCommandPalette(toggle);
    return unregister;
  }, [registerToggleCommandPalette, toggle]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, commands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && commands[selectedIndex]) {
        e.preventDefault();
        executeCommand(commands[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, selectedIndex, commands, executeCommand, close]);

  useEffect(() => {
    const selected = listRef.current?.children[selectedIndex] as HTMLElement;
    if (selected && typeof selected.scrollIntoView === 'function') {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <>
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={closeShortcuts} />
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[20vh]"
          onClick={close}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white shadow-2xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 p-4 dark:border-gray-700">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or invoice number..."
                className="w-full border-none bg-transparent px-4 py-2 text-lg text-gray-900 outline-none placeholder-gray-400 dark:text-gray-100"
              />
            </div>

            {!query && commands.length > 0 && (
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2 text-xs font-semibold uppercase text-gray-500 dark:bg-gray-800/50 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <span>Recent</span>
                <button
                  onClick={() => {
                    clearHistory();
                    inputRef.current?.focus();
                  }}
                  className="hover:text-gray-800 hover:underline dark:hover:text-gray-200 focus:outline-none"
                >
                  Clear History
                </button>
              </div>
            )}

            <div ref={listRef} className="max-h-96 overflow-y-auto">
              {commands.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  {query ? 'No commands found' : 'No recent commands'}
                </div>
              ) : (
                commands.map((cmd, index) => (
                  <div
                    key={cmd.id}
                    onClick={() => executeCommand(cmd)}
                    className={`flex cursor-pointer items-center justify-between px-4 py-3 ${
                      index === selectedIndex
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span className="text-gray-900 dark:text-gray-100">{cmd.label}</span>
                    <span className="text-xs uppercase text-gray-500 dark:text-gray-400">
                      {cmd.category}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <div className="flex gap-4">
                <span>
                  <kbd className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">Up/Down</kbd>{' '}
                  Navigate
                </span>
                <span>
                  <kbd className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">Enter</kbd>{' '}
                  Select
                </span>
                <span>
                  <kbd className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">Esc</kbd>{' '}
                  Close
                </span>
              </div>
              <span>Tip: Type # + number for invoices</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
