'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X } from 'lucide-react';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';

interface InvoiceNotificationPromptProps {
  invoiceId: string;
  dueDate: number; // Unix timestamp in seconds
  isPartyToInvoice: boolean;
}

const STORAGE_KEY = 'iln_invoice_reminders';

export const InvoiceNotificationPrompt: React.FC<InvoiceNotificationPromptProps> = ({
  invoiceId,
  dueDate,
  isPartyToInvoice,
}) => {
  const { permission, requestPermission, showNotification } = useBrowserNotifications();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isOptedIn, setIsOptedIn] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return !!stored[invoiceId];
    }
    return false;
  });

  const scheduleReminder = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const reminderTime = dueDate - 24 * 60 * 60; // 24 hours before
    const delay = (reminderTime - now) * 1000;

    if (delay > 0) {
      const timer = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          showNotification(`Invoice #${invoiceId} is due tomorrow`, {
            body: "Don't forget to settle your payment on time to maintain your reputation score.",
            icon: '/logo.png',
          });
        }
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [dueDate, invoiceId, showNotification]);

  useEffect(() => {
    if (isOptedIn && permission === 'granted') {
      return scheduleReminder();
    }
  }, [isOptedIn, permission, scheduleReminder]);

  const handleOptIn = async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      stored[invoiceId] = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setIsOptedIn(true);
    }
  };

  if (!isPartyToInvoice || isOptedIn || isDismissed || permission === 'denied') {
    return null;
  }

  return (
    <div className="bg-indigo-600 dark:bg-indigo-700 text-white p-4 rounded-lg shadow-lg flex items-center justify-between mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center space-x-3">
        <div className="bg-indigo-500 p-2 rounded-full">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <p className="font-medium text-sm">Get notified 24 hours before this invoice expires?</p>
          <p className="text-xs text-indigo-100">
            {"We'll"} send you a browser notification to help you stay on track.
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={handleOptIn}
          className="bg-white text-indigo-600 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-indigo-50 transition-colors"
        >
          Enable Notifications
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-indigo-500 rounded-md transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
