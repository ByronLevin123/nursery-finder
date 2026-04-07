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
import reviewsRouter from './routes/reviews.js'
import profileRouter from './routes/profile.js'
import propertiesRouter from './routes/properties.js'
import emailRouter from './routes/email.js'
import savedSearchesRouter from './routes/savedSearches.js'
import overlaysRouter from './routes/overlays.js'
import claimsRouter from './routes/claims.js'
import providerRouter from './routes/provider.js'
import { optionalAuth } from './middleware/supabaseAuth.js'

// AI feature routes (Claude-powered) — separate block, do not merge with mounts above
import aiRouter from './routes/ai.js'
import assistantRouter from './routes/assistant.js'

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

// Optional auth — attaches req.user if a valid bearer token is present
app.use(optionalAuth)

// Routes
app.use('/api/v1/health', healthRouter)
app.use('/api/v1/profile', profileRouter)
app.use('/api/v1/nurseries', nurseriesRouter)
app.use('/api/v1/nurseries', reviewsRouter)
app.use('/api/v1/ingest', ingestRouter)
app.use('/api/v1/areas', areasRouter)
app.use('/api/v1/properties', propertiesRouter)
app.use('/api/v1/sitemap', sitemapRouter)
app.use('/api/v1/email', emailRouter)
app.use('/api/v1/saved-searches', savedSearchesRouter)
app.use('/api/v1/overlays', overlaysRouter)
app.use('/api/v1/claims', claimsRouter)
app.use('/api/v1/provider', providerRouter)

// AI routes — mounted at /api/v1 so router defines its own subpaths
app.use('/api/v1', aiRouter)
app.use('/api/v1/assistant', assistantRouter)

// Sentry error handler — must be after routes, before our error handler
if (process.env.SENTRY_DSN && typeof Sentry.setupExpressErrorHandler === 'function') {
  Sentry.setupExpressErrorHandler(app)
}

// 404 + error handling
app.use(notFound)
app.use(errorHandler)

export default app
