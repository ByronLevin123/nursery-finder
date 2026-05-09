import 'dotenv/config'
import app from './app.js'
import { logger } from './logger.js'

// Validate required environment variables before starting
const REQUIRED_PRODUCTION_VARS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY']
const REQUIRED_PAYMENT_VARS = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
const RECOMMENDED_VARS = ['FRONTEND_URL', 'SENTRY_DSN', 'RESEND_API_KEY', 'ANTHROPIC_API_KEY']

if (process.env.NODE_ENV === 'production') {
  const missing = REQUIRED_PRODUCTION_VARS.filter((v) => !process.env[v])
  if (missing.length) {
    logger.fatal({ missing }, 'Missing required environment variables — refusing to start')
    process.exit(1)
  }
  const missingPayment = REQUIRED_PAYMENT_VARS.filter((v) => !process.env[v])
  if (missingPayment.length) {
    logger.warn({ missing: missingPayment }, 'Payment environment variables not set — billing features will be unavailable')
  }
  const missingRecommended = RECOMMENDED_VARS.filter((v) => !process.env[v])
  if (missingRecommended.length) {
    logger.warn({ missing: missingRecommended }, 'Recommended environment variables not set')
  }
}

const PORT = process.env.PORT || 3001

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'CompareTheNursery API started')
})

// Graceful shutdown — let in-flight requests finish before exiting
function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received, closing server…')
  server.close(() => {
    logger.info('Server closed, exiting')
    process.exit(0)
  })
  // Force exit after 10s if connections don't drain
  setTimeout(() => {
    logger.warn('Forcing exit after 10s timeout')
    process.exit(1)
  }, 10_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Global error handlers — log and exit rather than crash silently
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection')
})

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down')
  shutdown('uncaughtException')
})
