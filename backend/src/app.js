import * as Sentry from '@sentry/node'
import express from 'express'
import cors from 'cors'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV || 'development',
  })
}

import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'
import { logger } from './logger.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import healthRouter from './routes/health.js'
import nurseriesRouter from './routes/nurseries.js'
import ingestRouter from './routes/ingest.js'
import areasRouter from './routes/areas.js'
import sitemapRouter from './routes/sitemap.js'

const app = express()

// Security
app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  })
)

// Request logging
app.use(pinoHttp({ logger }))

// Rate limiting — public endpoints
app.use(
  '/api/v1/nurseries',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later' },
  })
)

// Body parsing
app.use(express.json({ limit: '1mb' }))

// Routes
app.use('/api/v1/health', healthRouter)
app.use('/api/v1/nurseries', nurseriesRouter)
app.use('/api/v1/ingest', ingestRouter)
app.use('/api/v1/areas', areasRouter)
app.use('/api/v1/sitemap', sitemapRouter)

// Sentry error handler — must be after routes, before our error handler
if (process.env.SENTRY_DSN && typeof Sentry.setupExpressErrorHandler === 'function') {
  Sentry.setupExpressErrorHandler(app)
}

// 404 + error handling
app.use(notFound)
app.use(errorHandler)

export default app
