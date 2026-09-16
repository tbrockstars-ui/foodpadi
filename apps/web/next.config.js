/** @type {import('next').NextConfig} */
// (touched again to force a clean dev-server route-table rebuild)
const nextConfig = {
  reactStrictMode: true,

  // Serve AVIF/WebP from next/image where the browser supports it — the
  // hero/decor PNGs and cuisine photos are the page's heaviest bytes.
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Per-route tree-shaking for barrel-heavy packages: framer-motion is large
  // and most routes use a small slice of it; @foodpadi/shared is a single
  // barrel re-exporting every DTO/type. Both drop dead weight from each
  // route's client bundle. (Next 14.2 — stable-enough for build-time only.)
  experimental: {
    optimizePackageImports: ['framer-motion', '@foodpadi/shared'],
  },

  // Strip console.* from the production client bundle, but keep error/warn so
  // real problems still surface in the field.
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  productionBrowserSourceMaps: false,

  // The canonical legal pages live under /legal/* (existing convention —
  // /legal/disclaimer predates this), but a launch brief and any external
  // links/ads may reasonably point at the bare paths. Redirect rather than
  // duplicate the pages.
  async redirects() {
    return [
      { source: '/privacy', destination: '/legal/privacy', permanent: false },
      { source: '/terms', destination: '/legal/terms', permanent: false },
      { source: '/cookies', destination: '/legal/cookies', permanent: false },
      { source: '/contact', destination: '/legal/contact', permanent: false },
      { source: '/delete-account', destination: '/legal/delete-account', permanent: false },
      { source: '/data-request', destination: '/legal/data-request', permanent: false },
    ];
  },
};

module.exports = nextConfig;
