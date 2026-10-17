import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Feature-flag-gated routes that are disabled by default must not be
      // indexed. These paths only serve functional content when the
      // corresponding NEXT_PUBLIC_*_ENABLED flag is true; when disabled the
      // components are removed from the DOM entirely, so any indexed URL would
      // return an empty / broken page.
      disallow: [
        // Insurance pool — gated by NEXT_PUBLIC_INSURANCE_POOL_ENABLED
        '/lp/insurance',
        // NFT detail sub-paths — gated by NEXT_PUBLIC_NFT_ENABLED
        '/i/*/nft',
        // Admin internal pages — not public-facing
        '/admin',
        '/admin/*',
      ],
    },
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.iln.finance'}/sitemap.xml`,
  };
}
