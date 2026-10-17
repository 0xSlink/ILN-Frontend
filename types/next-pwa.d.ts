declare module 'next-pwa' {
  import type { NextConfig } from 'next';

  export interface RuntimeCachingRule {
    urlPattern: RegExp | ((options: { request: Request; url: URL }) => boolean);
    handler: 'CacheFirst' | 'CacheOnly' | 'NetworkFirst' | 'NetworkOnly' | 'StaleWhileRevalidate';
    options?: {
      cacheName?: string;
      expiration?: {
        maxEntries?: number;
        maxAgeSeconds?: number;
      };
      networkTimeoutSeconds?: number;
      cacheableResponse?: {
        statuses?: number[];
        headers?: Record<string, string>;
      };
    };
  }

  export interface PWAConfig {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    scope?: string;
    skipWaiting?: boolean;
    clientsClaim?: boolean;
    sw?: string;
    runtimeCaching?: RuntimeCachingRule[];
    subdomains?: boolean;
    fallbacks?: {
      document?: string;
      image?: string;
      audio?: string;
      video?: string;
      font?: string;
    };
  }

  function withPWA(
    pwaConfig?: PWAConfig
  ): (nextConfig?: NextConfig & { allowedDevOrigins?: string[] }) => NextConfig;

  export default withPWA;
}
