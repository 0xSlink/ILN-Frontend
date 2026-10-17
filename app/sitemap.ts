import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

const BASE_URL = env.NEXT_PUBLIC_APP_URL;

// Routes that are always public and do not require a feature flag.
const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: `${BASE_URL}/`, changeFrequency: 'daily', priority: 1.0 },
  { url: `${BASE_URL}/dashboard`, changeFrequency: 'daily', priority: 0.9 },
  { url: `${BASE_URL}/invoices`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${BASE_URL}/marketplace`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${BASE_URL}/leaderboard`, changeFrequency: 'weekly', priority: 0.6 },
  { url: `${BASE_URL}/governance`, changeFrequency: 'weekly', priority: 0.6 },
  { url: `${BASE_URL}/profile`, changeFrequency: 'weekly', priority: 0.5 },
  { url: `${BASE_URL}/roadmap`, changeFrequency: 'monthly', priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [...STATIC_ROUTES];

  // Feature-flag-gated routes are only included in the sitemap when the
  // corresponding flag is enabled. When disabled, these paths render no
  // meaningful content (the gated components are fully removed from the DOM),
  // so including them would create broken sitemap entries.
  if (env.NEXT_PUBLIC_INSURANCE_POOL_ENABLED) {
    routes.push({
      url: `${BASE_URL}/lp/insurance`,
      changeFrequency: 'daily',
      priority: 0.7,
    });
  }

  // NFT detail pages are dynamic; the oracle badge is an inline component
  // (no dedicated route), so neither gets a static sitemap entry even when
  // enabled — they appear as sub-resources of existing invoice routes.

  return routes;
}
