'use client';

import React, { createContext, useCallback, useContext, ReactNode, useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import AppToaster from '@/components/AppToaster';
import { TOAST_AUTO_DISMISS_MS } from '@/lib/toast-config';

export type ToastType = 'pending' | 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string | React.ReactNode;
  txHash?: string;
  action?: ToastAction;
}

interface ToastContextType {
  addToast: (toast: Omit<ToastMessage, 'id'>) => string;
  updateToast: (id: string, updates: Partial<Omit<ToastMessage, 'id'>>) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

function buildDescription(toast: Omit<ToastMessage, 'id'>): React.ReactNode | undefined {
  if (React.isValidElement(toast.message)) {
    if (toast.txHash) {
      return (
        <div className="flex flex-col gap-2">
          {toast.message}
          <div className="text-xs opacity-80">Tx: {toast.txHash.slice(0, 8)}…</div>
        </div>
      );
    }
    return toast.message;
  }

  const parts: string[] = [];
  if (typeof toast.message === 'string') parts.push(toast.message);
  if (toast.txHash) parts.push(`Tx: ${toast.txHash.slice(0, 8)}…`);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function durationForType(type: ToastType): number | typeof Infinity {
  if (type === 'error' || type === 'pending') return Infinity;
  return TOAST_AUTO_DISMISS_MS;
}

function showSonnerToast(id: string, toast: Omit<ToastMessage, 'id'>) {
  const options = {
    id,
    description: buildDescription(toast),
    duration: durationForType(toast.type),
    action: toast.action ? { label: toast.action.label, onClick: toast.action.onClick } : undefined,
  };

  switch (toast.type) {
    case 'success':
      sonnerToast.success(toast.title, options);
      break;
    case 'error':
      sonnerToast.error(toast.title, options);
      break;
    case 'info':
      sonnerToast.info(toast.title, options);
      break;
    case 'warning':
      sonnerToast.warning(toast.title, options);
      break;
    case 'pending':
      sonnerToast.loading(toast.title, options);
      break;
    default:
      sonnerToast(toast.title, options);
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [announcement, setAnnouncement] = useState('');

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 11);

    // Announce to screen readers
    let messageText = '';
    if (typeof toast.message === 'string') {
      messageText = toast.message;
    } else if (toast.message && React.isValidElement(toast.message)) {
      // For React elements, extract text content if possible
      // This is a simplified approach - in production you might want more robust extraction
      messageText = 'Additional details available';
    }

    const announcementText = `${toast.title}${messageText ? `. ${messageText}` : ''}`;
    setAnnouncement(announcementText);

    // Clear announcement after screen readers have time to read it
    setTimeout(() => setAnnouncement(''), 1000);

    showSonnerToast(id, toast);
    return id;
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<ToastMessage, 'id'>>) => {
    // Announce updates to screen readers
    const message = typeof updates.message === 'string' ? updates.message : '';
    const announcementText = `Updated: ${updates.title || 'Toast'}${message ? `. ${message}` : ''}`;
    setAnnouncement(announcementText);

    // Clear announcement after screen readers have time to read it
    setTimeout(() => setAnnouncement(''), 1000);

    showSonnerToast(id, {
      type: updates.type ?? 'info',
      title: updates.title ?? 'Updated',
      ...updates,
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    sonnerToast.dismiss(id);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, updateToast, removeToast }}>
      {children}
      <AppToaster />
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="toast-live-region"
      >
        {announcement}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
