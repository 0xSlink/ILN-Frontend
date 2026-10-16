'use client';

import { Toaster } from 'sonner';
import { TOAST_AUTO_DISMISS_MS, TOAST_MAX_VISIBLE, TOAST_POSITION } from '@/lib/toast-config';

export default function AppToaster() {
  return (
    <Toaster
      position={TOAST_POSITION}
      visibleToasts={TOAST_MAX_VISIBLE}
      duration={TOAST_AUTO_DISMISS_MS}
      closeButton
      richColors
      expand={false}
      gap={8}
      // Sonner handles ARIA attributes on individual toasts internally, but
      // its default container label ("Notifications") is generic enough to
      // be ambiguous next to the app's own Notification Bell panel - give
      // the toast queue landmark its own distinct, meaningful name.
      containerAriaLabel="Toast notifications"
      toastOptions={{
        classNames: {
          toast: 'font-sans',
        },
      }}
    />
  );
}
