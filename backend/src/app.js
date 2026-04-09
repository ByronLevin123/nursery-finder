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
import publicMarkdownRouter from './routes/publicMarkdown.js'
import openapi from './openapi.js'
import emailRouter from './routes/email.js'
import savedSearchesRouter from './routes/savedSearches.js'
import overlaysRouter from './routes/overlays.js'
import claimsRouter from './routes/claims.js'
import providerRouter from './routes/provider.js'
import travelRouter from './routes/travel.js'
import { optionalAuth } from './middleware/supabaseAuth.js'

// Decision engine routes
import quizRouter from './routes/quiz.js'
import enquiriesRouter from './routes/enquiries.js'
import providerDataRouter from './routes/providerData.js'

// Visit booking + provider enquiries + provider analytics
import visitsRouter from './routes/visits.js'
import providerEnquiriesRouter from './routes/providerEnquiries.js'
import providerSlotsRouter from './routes/providerSlots.js'
import providerAnalyticsRouter from './routes/providerAnalytics.js'

// Notifications + messaging
import messagesRouter from './routes/messages.js'
import notificationsRouter from './routes/notifications.js'

// Billing + Stripe
import billingRouter, { billingWebhookHandler } from './routes/billing.js'

// Admin dashboard
import adminRouter from './routes/admin.js'

// AI feature routes (Claude-powered) — separate block, do not merge with mounts above
import aiRouter from './routes/ai.js'
import assistantRouter from './routes/assistant.js'

const app = express()

// Security
app.use(helmet())

// Open CORS for public read endpoints (LLM agents + Custom GPT actions)
const publicCorsPaths = [
  '/api/v1/nurseries',
  '/api/v1/areas',
  '/api/v1/properties/districts',
  '/api/v1/overlays',
  '/api/v1/public',
  '/api/openapi.json',
]
app.use(publicCorsPaths, cors({ origin: '*', methods: ['GET', 'POST'] }))

// Default CORS for everything else (auth-protected etc.)
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  })
)

// Request logging
app.use(pinoHttp({ logger }))

// Rate limiting — public endpoints (100 req / 15 min per IP)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})
app.use('/api/v1/nurseries', publicLimiter)
app.use('/api/v1/areas', publicLimiter)
app.use('/api/v1/properties', publicLimiter)
app.use('/api/v1/overlays', publicLimiter)
app.use('/api/v1/public', publicLimiter)

// Stripe webhook — MUST be before json body parser (needs raw body)
app.post(
  '/api/v1/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingWebhookHandler
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
app.use('/api/v1/provider', providerDataRouter)
app.use('/api/v1/quiz', quizRouter)
app.use('/api/v1', quizRouter)
app.use('/api/v1/enquiries', enquiriesRouter)
app.use('/api/v1/travel', travelRouter)
app.use('/api/v1/visits', visitsRouter)
app.use('/api/v1/provider', providerEnquiriesRouter)
app.use('/api/v1/provider', providerSlotsRouter)
app.use('/api/v1/provider', providerAnalyticsRouter)
app.use('/api/v1', providerAnalyticsRouter) // for POST /api/v1/nurseries/:urn/view
app.use('/api/v1/public', publicMarkdownRouter)
app.use('/api/v1/enquiries', messagesRouter)
app.use('/api/v1/notifications', notificationsRouter)
app.use('/api/v1/billing', billingRouter)
app.use('/api/v1/admin', adminRouter)

// Public OpenAPI spec for LLM agents + ChatGPT Custom GPT
app.get('/api/openapi.json', (req, res, next) => {
  try {
    res.json(openapi)
  } catch (err) {
    next(err)
  }
})

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
