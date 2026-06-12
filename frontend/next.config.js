if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn('\x1b[33m[NurseryMatch] WARNING: NEXT_PUBLIC_API_URL is not set. All API calls will fail.\x1b[0m')
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/.well-known/:path*',
        destination: '/.well-known/:path*',
      },
    ]
  },
  // Security headers for all pages — Vercel only adds HSTS by itself.
  // No CSP yet: pages legitimately load Plausible, gtag/AdSense, Turnstile,
  // map tiles and Street View, so a CSP needs careful allowlisting (tracked
  // in docs/ROADMAP.md) rather than a blind deny.
  // geolocation=(self) keeps the "nurseries near me" page working.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ]
  },
}

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  // Only load the Sentry wrapper when a DSN is configured, so builds work
  // without @sentry/nextjs installed.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { withSentryConfig } = require('@sentry/nextjs')
  module.exports = withSentryConfig(nextConfig, {
    silent: true,
    disableServerWebpackPlugin: true,
    disableClientWebpackPlugin: true,
  })
} else {
  module.exports = nextConfig
}
