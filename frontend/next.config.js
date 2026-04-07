/** @type {import('next').NextConfig} */
const nextConfig = {}

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
