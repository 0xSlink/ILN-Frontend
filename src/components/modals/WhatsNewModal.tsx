'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useWhatsNew } from '@/hooks/useWhatsNew';

export default function WhatsNewModal() {
  const { isOpen, dismiss, items, currentVersion } = useWhatsNew();
  const dialogRef = useRef<HTMLDivElement>(null);
  const gotItBtnRef = useRef<HTMLButtonElement>(null);

  // Handle ESC key to dismiss and Focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
      }

      // Basic focus trap
      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const focusableElements = dialogRef.current.querySelectorAll(
          'a[href], button, textarea, input, select'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Auto-focus the primary button on open
    gotItBtnRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, dismiss]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="w-full max-w-md overflow-hidden rounded-3xl bg-surface shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant/20 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
            🎉
          </div>
          <h2 id="whats-new-title" className="text-xl font-headline font-bold text-on-surface">
            What&apos;s New in{' '}
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-sm text-primary">
              {currentVersion}
            </span>
          </h2>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ul className="flex flex-col gap-6">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-4">
                <span className="text-2xl leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-on-surface">{item.title}</h3>
                  <p className="mt-1 text-sm text-on-surface-variant leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/20 flex flex-col gap-4">
          <Link
            href="/changelog"
            onClick={dismiss}
            className="text-sm font-medium text-primary hover:underline self-center"
          >
            See full changelog &rarr;
          </Link>
          <button
            ref={gotItBtnRef}
            onClick={dismiss}
            className="w-full rounded-xl bg-primary px-6 py-3 font-bold text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
