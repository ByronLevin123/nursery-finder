import 'dotenv/config'
import app from './app.js'
import { logger } from './logger.js'

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
