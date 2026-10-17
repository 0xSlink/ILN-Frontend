if (!self.define) {
  let e,
    s = {};
  const a = (a, c) => (
    (a = new URL(a + '.js', c).href),
    s[a] ||
      new Promise((s) => {
        if ('document' in self) {
          const e = document.createElement('script');
          (e.src = a), (e.onload = s), document.head.appendChild(e);
        } else (e = a), importScripts(a), s();
      }).then(() => {
        let e = s[a];
        if (!e) throw new Error(`Module ${a} didn’t register its module`);
        return e;
      })
  );
  self.define = (c, n) => {
    const i = e || ('document' in self ? document.currentScript.src : '') || location.href;
    if (s[i]) return;
    let t = {};
    const r = (e) => a(e, i),
      f = { module: { uri: i }, exports: t, require: r };
    s[i] = Promise.all(c.map((e) => f[e] || r(e))).then((e) => (n(...e), t));
  };
}
define(['./workbox-00a24876'], function (e) {
  'use strict';
  importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        { url: '/_next/static/chunks/1391-961bd5e2d9f4572a.js', revision: '961bd5e2d9f4572a' },
        { url: '/_next/static/chunks/164f4fb6.c7b908a3ba549b80.js', revision: 'c7b908a3ba549b80' },
        { url: '/_next/static/chunks/1868.34ab72db5e917066.js', revision: '34ab72db5e917066' },
        { url: '/_next/static/chunks/1878.9157a61c5953c377.js', revision: '9157a61c5953c377' },
        { url: '/_next/static/chunks/1966.b8f83f7ba376c962.js', revision: 'b8f83f7ba376c962' },
        { url: '/_next/static/chunks/1992.def128471809c00b.js', revision: 'def128471809c00b' },
        { url: '/_next/static/chunks/2751-787281899bc6f3b5.js', revision: '787281899bc6f3b5' },
        { url: '/_next/static/chunks/2f0b94e8.ce53c98b232310fc.js', revision: 'ce53c98b232310fc' },
        { url: '/_next/static/chunks/3118.537c2cfa08e51168.js', revision: '537c2cfa08e51168' },
        { url: '/_next/static/chunks/3378-c146d4870541b356.js', revision: 'c146d4870541b356' },
        { url: '/_next/static/chunks/3704-23bedb55e31d3352.js', revision: '23bedb55e31d3352' },
        { url: '/_next/static/chunks/3792-d3a42c6593e2bff6.js', revision: 'd3a42c6593e2bff6' },
        { url: '/_next/static/chunks/3794-3fb4e6ee851037bb.js', revision: '3fb4e6ee851037bb' },
        { url: '/_next/static/chunks/3810.7c7d9da19a21c645.js', revision: '7c7d9da19a21c645' },
        { url: '/_next/static/chunks/3899.3f761f7e3a944e8c.js', revision: '3f761f7e3a944e8c' },
        { url: '/_next/static/chunks/4109-5728c0386f908a82.js', revision: '5728c0386f908a82' },
        { url: '/_next/static/chunks/4192-bfe0ec2a80ec1a99.js', revision: 'bfe0ec2a80ec1a99' },
        { url: '/_next/static/chunks/4543-762d0b1b36830ac2.js', revision: '762d0b1b36830ac2' },
        { url: '/_next/static/chunks/4758.c0fcf84aa012611f.js', revision: 'c0fcf84aa012611f' },
        { url: '/_next/static/chunks/4774-d17dbe090bd0860f.js', revision: 'd17dbe090bd0860f' },
        { url: '/_next/static/chunks/4bd1b696-e356ca5ba0218e27.js', revision: 'e356ca5ba0218e27' },
        { url: '/_next/static/chunks/5209-e55a9178c5bc3123.js', revision: 'e55a9178c5bc3123' },
        { url: '/_next/static/chunks/5286-c2280297379691d2.js', revision: 'c2280297379691d2' },
        { url: '/_next/static/chunks/577-22fd77919d34157a.js', revision: '22fd77919d34157a' },
        { url: '/_next/static/chunks/5902.0048591bede0095a.js', revision: '0048591bede0095a' },
        { url: '/_next/static/chunks/5918.de6ca11f34ccc41a.js', revision: 'de6ca11f34ccc41a' },
        { url: '/_next/static/chunks/639.c7a4f1c942dc6f44.js', revision: 'c7a4f1c942dc6f44' },
        { url: '/_next/static/chunks/6746-39f371723f5423a6.js', revision: '39f371723f5423a6' },
        { url: '/_next/static/chunks/6775-66edbe437e20d2cf.js', revision: '66edbe437e20d2cf' },
        { url: '/_next/static/chunks/7113.667b7795d4351fc3.js', revision: '667b7795d4351fc3' },
        { url: '/_next/static/chunks/7230-9b8ca30d78214f46.js', revision: '9b8ca30d78214f46' },
        { url: '/_next/static/chunks/7942-6e0a92910b11ffe1.js', revision: '6e0a92910b11ffe1' },
        { url: '/_next/static/chunks/8011-1458aaf2189563ae.js', revision: '1458aaf2189563ae' },
        { url: '/_next/static/chunks/8243.0dc4e51385cc67e2.js', revision: '0dc4e51385cc67e2' },
        { url: '/_next/static/chunks/8500-f62a38ff68ab7f42.js', revision: 'f62a38ff68ab7f42' },
        { url: '/_next/static/chunks/8786.f7aba2945beea169.js', revision: 'f7aba2945beea169' },
        { url: '/_next/static/chunks/9114-454303d96e15105a.js', revision: '454303d96e15105a' },
        { url: '/_next/static/chunks/9148-a008ca9b62bfa6cd.js', revision: 'a008ca9b62bfa6cd' },
        { url: '/_next/static/chunks/9300.0a85cda8235771c3.js', revision: '0a85cda8235771c3' },
        { url: '/_next/static/chunks/9587.56294d8e39d6f2c3.js', revision: '56294d8e39d6f2c3' },
        { url: '/_next/static/chunks/9898.7d9c5c098f868b57.js', revision: '7d9c5c098f868b57' },
        { url: '/_next/static/chunks/9989.72824e05400065fd.js', revision: '72824e05400065fd' },
        { url: '/_next/static/chunks/ad2866b8.6c51983a1eb56136.js', revision: '6c51983a1eb56136' },
        {
          url: '/_next/static/chunks/app/_global-error/page-06899cd8018133e3.js',
          revision: '06899cd8018133e3',
        },
        {
          url: '/_next/static/chunks/app/_not-found/page-ea8c9b8dd882e4eb.js',
          revision: 'ea8c9b8dd882e4eb',
        },
        {
          url: '/_next/static/chunks/app/admin/page-b582b929013a8ed5.js',
          revision: 'b582b929013a8ed5',
        },
        {
          url: '/_next/static/chunks/app/analytics/freelancer/page-967dcac7d6c5323b.js',
          revision: '967dcac7d6c5323b',
        },
        {
          url: '/_next/static/chunks/app/analytics/leaderboard/page-f2ffa558fbf757a2.js',
          revision: 'f2ffa558fbf757a2',
        },
        {
          url: '/_next/static/chunks/app/analytics/page-f98d2761c3ba194d.js',
          revision: 'f98d2761c3ba194d',
        },
        {
          url: '/_next/static/chunks/app/api/feedback/route-06899cd8018133e3.js',
          revision: '06899cd8018133e3',
        },
        {
          url: '/_next/static/chunks/app/api/notifications/%5Baddress%5D/route-06899cd8018133e3.js',
          revision: '06899cd8018133e3',
        },
        {
          url: '/_next/static/chunks/app/dashboard/page-1099e67d384a6b44.js',
          revision: '1099e67d384a6b44',
        },
        {
          url: '/_next/static/chunks/app/dashboard/payer/page-406adf9bc055d0ca.js',
          revision: '406adf9bc055d0ca',
        },
        {
          url: '/_next/static/chunks/app/freelancer/page-70951ab85748c49e.js',
          revision: '70951ab85748c49e',
        },
        {
          url: '/_next/static/chunks/app/governance/%5Bid%5D/page-7f12f139bbb35214.js',
          revision: '7f12f139bbb35214',
        },
        {
          url: '/_next/static/chunks/app/governance/how-it-works/page-50c97faa177ecdec.js',
          revision: '50c97faa177ecdec',
        },
        {
          url: '/_next/static/chunks/app/governance/new/page-8c37067a50e02ed0.js',
          revision: '8c37067a50e02ed0',
        },
        {
          url: '/_next/static/chunks/app/governance/page-d47f34cae27bf6a9.js',
          revision: 'd47f34cae27bf6a9',
        },
        {
          url: '/_next/static/chunks/app/i/%5Bid%5D/page-9b0a85d0e7c5e4eb.js',
          revision: '9b0a85d0e7c5e4eb',
        },
        {
          url: '/_next/static/chunks/app/layout-77db279ca8aa1bb5.js',
          revision: '77db279ca8aa1bb5',
        },
        {
          url: '/_next/static/chunks/app/leaderboard/page-b77ca16200f14d82.js',
          revision: 'b77ca16200f14d82',
        },
        {
          url: '/_next/static/chunks/app/lp/compare/page-9674b52fcaf99750.js',
          revision: '9674b52fcaf99750',
        },
        {
          url: '/_next/static/chunks/app/lp/page-4fb70a3a7abc6006.js',
          revision: '4fb70a3a7abc6006',
        },
        {
          url: '/_next/static/chunks/app/marketplace/page-1a5d463d461a7ff9.js',
          revision: '1a5d463d461a7ff9',
        },
        {
          url: '/_next/static/chunks/app/offline/page-ffa3fadaa4270bf5.js',
          revision: 'ffa3fadaa4270bf5',
        },
        { url: '/_next/static/chunks/app/page-3a74a181b7955951.js', revision: '3a74a181b7955951' },
        {
          url: '/_next/static/chunks/app/pay/%5Bid%5D/page-53bedd2b56ae224f.js',
          revision: '53bedd2b56ae224f',
        },
        {
          url: '/_next/static/chunks/app/payer/page-4c0de2989815eb1f.js',
          revision: '4c0de2989815eb1f',
        },
        {
          url: '/_next/static/chunks/app/profile/%5Baddress%5D/page-e7c4408fe860e6fe.js',
          revision: 'e7c4408fe860e6fe',
        },
        {
          url: '/_next/static/chunks/app/referrals/page-3e27e7ed0aaf14b3.js',
          revision: '3e27e7ed0aaf14b3',
        },
        {
          url: '/_next/static/chunks/app/roadmap/page-bb739f606f3c53de.js',
          revision: 'bb739f606f3c53de',
        },
        {
          url: '/_next/static/chunks/app/stats/page-533e19561ecea5fa.js',
          revision: '533e19561ecea5fa',
        },
        {
          url: '/_next/static/chunks/app/submit/page-b2e9fbea2ce32c1f.js',
          revision: 'b2e9fbea2ce32c1f',
        },
        { url: '/_next/static/chunks/bc98253f.b50765b70c666750.js', revision: 'b50765b70c666750' },
        { url: '/_next/static/chunks/eef1a047-7254cb0d5817129c.js', revision: '7254cb0d5817129c' },
        { url: '/_next/static/chunks/framework-711ef29bc66f648c.js', revision: '711ef29bc66f648c' },
        { url: '/_next/static/chunks/main-app-e52d1f9d15090945.js', revision: 'e52d1f9d15090945' },
        { url: '/_next/static/chunks/main-ba4b20f5db724165.js', revision: 'ba4b20f5db724165' },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/app-error-06899cd8018133e3.js',
          revision: '06899cd8018133e3',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/forbidden-06899cd8018133e3.js',
          revision: '06899cd8018133e3',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/global-error-cb1361a207a80afd.js',
          revision: 'cb1361a207a80afd',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/not-found-06899cd8018133e3.js',
          revision: '06899cd8018133e3',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/unauthorized-06899cd8018133e3.js',
          revision: '06899cd8018133e3',
        },
        {
          url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
          revision: '846118c33b2c0e922d7b3a7676f81f6f',
        },
        { url: '/_next/static/chunks/webpack-eaa77253b0aae7ef.js', revision: 'eaa77253b0aae7ef' },
        { url: '/_next/static/css/15cd3debd7a373f7.css', revision: '15cd3debd7a373f7' },
        {
          url: '/_next/static/pKS4d3nyqNygWrBYMiAFZ/_buildManifest.js',
          revision: '29496f86a9f76852edf22d0d786b4fa4',
        },
        {
          url: '/_next/static/pKS4d3nyqNygWrBYMiAFZ/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        { url: '/file.svg', revision: 'd09f95206c3fa0bb9bd9fefabfd0ea71' },
        { url: '/globe.svg', revision: '2aaafa6a49b6563925fe440891e32717' },
        { url: '/locales/en/translation.json', revision: '46c7e394651e5ff8a2e5deb73a3e1861' },
        { url: '/locales/es/translation.json', revision: 'ec1e87af8415701e789b8ef68452d5e9' },
        { url: '/manifest.json', revision: 'b262860ecf8e530ff50b1ff08c081cbd' },
        { url: '/mockServiceWorker.js', revision: 'f51d191363e170f7c355cacf3844cfe3' },
        { url: '/next.svg', revision: '8e061864f388b47f33a1c3780831193e' },
        { url: '/tokens/eurc.svg', revision: 'f5b22abb64d66ad0f405dd5d4a5f32ab' },
        { url: '/tokens/usdc.svg', revision: '79f4df2dcc7008f14e097ea1adcf078b' },
        { url: '/tokens/xlm.svg', revision: '2f1e6476b4789eee85d24dd630e7a099' },
        { url: '/vercel.svg', revision: 'c0af2f507b369b085b35ef4bbe3bcf1e' },
        { url: '/window.svg', revision: 'a2760511c65806022ad20adf74370ff3' },
      ],
      { ignoreURLParametersMatching: [] }
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      '/',
      new e.NetworkFirst({
        cacheName: 'start-url',
        plugins: [
          {
            cacheWillUpdate: async ({ request: e, response: s, event: a, state: c }) =>
              s && 'opaqueredirect' === s.type
                ? new Response(s.body, { status: 200, statusText: 'OK', headers: s.headers })
                : s,
          },
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /^https:\/\/fonts\.googleapis\.com\/.*/i,
      new e.CacheFirst({
        cacheName: 'google-fonts',
        plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 })],
      }),
      'GET'
    ),
    e.registerRoute(
      /^https:\/\/fonts\.gstatic\.com\/.*/i,
      new e.CacheFirst({
        cacheName: 'google-fonts-static',
        plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 })],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:js|css|woff|woff2|ttf|eot)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-assets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })],
      }),
      'GET'
    ),
    e.registerRoute(
      /\/api\/.*$/i,
      new e.NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        plugins: [new e.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 })],
      }),
      'GET'
    ),
    e.registerRoute(
      ({ request: e }) => 'document' === e.destination,
      new e.NetworkFirst({
        cacheName: 'pages',
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET'
    );
});
