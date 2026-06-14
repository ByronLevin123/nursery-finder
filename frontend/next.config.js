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
  // NOTE: security headers (CSP, HSTS, frame DENY, nosniff, referrer +
  // permissions policy) live in frontend/vercel.json so there is a single
  // source of truth on Vercel — do not also set them here or they'd be
  // emitted twice.
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
