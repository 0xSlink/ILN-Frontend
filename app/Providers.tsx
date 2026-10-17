'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import ThemeProvider from '@/components/ThemeProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 minute
          },
        },
      })
  );

  useEffect(() => {
    // Install global error-tracking enrichment (#794) — browser/OS/wallet context
    // on every error captured by Sentry or the local `iln:error` bridge.
    import('@/lib/errorTracking')
      .then(({ installGlobalErrorTracking, attachCompatibilityContextToSentry }) => {
        installGlobalErrorTracking();
        attachCompatibilityContextToSentry();
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_API_MOCKING !== 'enabled') return;
    import('@/mocks/browser')
      .then(({ worker }) => worker.start({ onUnhandledRequest: 'bypass', quiet: true }))
      .catch(() => undefined);
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
