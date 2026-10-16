import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import './globals.css';
import I18nProvider from '@/components/I18nProvider';
import { ToastProvider } from '@/context/ToastContext';
import { WalletProvider } from '@/context/WalletContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { KeyboardShortcutsProvider } from '@/context/KeyboardShortcutsContext';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';
import FABProvider from '@/components/FABProvider';
import FeedbackWidget from '@/components/FeedbackWidget';
import CommandPalette from '@/components/CommandPalette';
import OfflineBanner from '@/components/OfflineBanner';
import NetworkMismatchBanner from '@/components/NetworkMismatchBanner';
import ContractEventSync from '@/components/ContractEventSync';
import WhatsNewModal from '@/components/modals/WhatsNewModal';
import Providers from './Providers';

export const metadata: Metadata = {
  title: 'ILN | Invoice Liquidity Network',
  description: 'An open-source invoice factoring protocol on Stellar.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3d627f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ILN" />
        <meta name="description" content="Decentralized invoice factoring on Stellar" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#3d627f" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, viewport-fit=cover"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var localTheme = localStorage.getItem('theme');
                  var prefTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (localTheme === 'dark' || (!localTheme && prefTheme)) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground transition-colors duration-300 selection:bg-primary-container selection:text-on-primary-container">
        <I18nProvider>
          <Providers>
            <ToastProvider>
              <ContractEventSync />
              <WalletProvider>
                <NotificationProvider>
                  <KeyboardShortcutsProvider>
                    <OfflineBanner />
                    <NetworkMismatchBanner />
                    <FABProvider />
                    <div className="min-h-screen flex flex-col">
                      <div className="flex-1">
                        <Suspense fallback={null}>{children}</Suspense>
                      </div>
                    </div>
                    <Suspense fallback={null}>
                      <OnboardingFlow />
                    </Suspense>
                    <Suspense fallback={null}>
                      <WhatsNewModal />
                    </Suspense>
                    <Suspense fallback={null}>
                      <CommandPalette />
                    </Suspense>
                    <FeedbackWidget />
                  </KeyboardShortcutsProvider>
                </NotificationProvider>
              </WalletProvider>
            </ToastProvider>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
