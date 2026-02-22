import { logger } from '../logger.js'

export function errorHandler(err, req, res, next) {
  logger.error({ err: err.message, path: req.path, method: req.method }, 'unhandled error')

  const status = err.status || err.statusCode || 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message

  res.status(status).json({ error: message, status })
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found', status: 404 })
}
