'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const NotificationsPage = dynamic(() => import('@/screens/NotificationsPage'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-surface-container flex flex-col items-center justify-center text-on-surface-variant font-medium gap-3">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      Loading Notifications...
    </div>
  ),
});

export default function NotificationsRoute() {
  useDocumentTitle({ pageTitle: 'Notifications' });
  return (
    <Suspense fallback={null}>
      <NotificationsPage />
    </Suspense>
  );
}
