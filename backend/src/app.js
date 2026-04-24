import * as Sentry from '@sentry/node'
import express from 'express'
import compression from 'compression'
import cors from 'cors'
import db from './db.js'

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
import swaggerUi from 'swagger-ui-express'
import emailRouter from './routes/email.js'
import savedSearchesRouter from './routes/savedSearches.js'
import overlaysRouter from './routes/overlays.js'
import claimsRouter from './routes/claims.js'
import providerRouter from './routes/provider.js'
import travelRouter from './routes/travel.js'
import qaRouter from './routes/qa.js'
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

// Provider acquisition — invite outreach
import providerInvitesRouter from './routes/providerInvites.js'

// Provider registration + combined claim
import providerAuthRouter from './routes/providerAuth.js'

// Promotions — admin CRUD + public nearby matching
import promotionsRouter, { adminPromotionsRouter } from './routes/promotions.js'

// Provider reports
import providerReportsRouter from './routes/providerReports.js'

// Blog / guides content
import blogRouter from './routes/blog.js'

// Schools (nearby primary schools overlay)
import schoolsRouter from './routes/schools.js'

// AI feature routes (Claude-powered) — separate block, do not merge with mounts above
import aiRouter from './routes/ai.js'
import assistantRouter from './routes/assistant.js'

const app = express()

// Trust the first proxy (Render's load balancer). Without this, every client
// appears to come from the LB's IP, which causes express-rate-limit to treat
// all users as the same "IP" — the per-IP limit becomes a global cap and the
// site 429s as soon as a handful of users browse. With `1`, express reads the
// left-most IP from X-Forwarded-For, which is the real client.
app.set('trust proxy', 1)

// Security
app.use(helmet())

// Response compression
app.use(compression())

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})

// Cache headers — hook into res.json/res.send to set after all middleware
app.use((req, res, next) => {
  const origJson = res.json.bind(res)
  res.json = function (body) {
    if (req.method !== 'GET') {
      res.set('Cache-Control', 'no-store')
    } else {
      const p = req.originalUrl.split('?')[0]
      if (p === '/api/v1/health') {
        res.set('Cache-Control', 'no-cache')
      } else if (p === '/api/v1/nurseries/search' || p === '/api/v1/nurseries/smart-search') {
        res.set('Cache-Control', 'public, max-age=300')
      } else if (/^\/api\/v1\/nurseries\/[^/]+$/.test(p)) {
        res.set('Cache-Control', 'public, max-age=3600')
      } else if (/^\/api\/v1\/areas\/[^/]+$/.test(p)) {
        res.set('Cache-Control', 'public, max-age=3600')
      } else if (p === '/api/v1/billing/tiers') {
        res.set('Cache-Control', 'public, max-age=86400')
      }
    }
    return origJson(body)
  }
  next()
})

// Open CORS for public read endpoints (LLM agents + Custom GPT actions)
const publicCorsPaths = [
  '/api/v1/nurseries',
  '/api/v1/areas',
  '/api/v1/properties/districts',
  '/api/v1/overlays',
  '/api/v1/schools',
  '/api/v1/public',
  '/api/v1/blog',
  '/api/openapi.json',
]
app.use(publicCorsPaths, cors({ origin: '*', methods: ['GET', 'POST'] }))

// Default CORS for everything else (auth-protected etc.)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://nurserymatch.com',
  'https://www.nurserymatch.com',
  'https://nursery-finder.vercel.app',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000'] : []),
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin || '*')
      } else {
        callback(null, false)
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  })
)

// Request logging
app.use(pinoHttp({ logger }))

// Rate limiting — public endpoints (300 req / 15 min per IP).
// A single Find-an-Area or Search page can fan out 10+ requests per navigation
// (area summaries per district, nursery details, overlays). 300/15min per real
// client IP is generous for normal browsing and still blocks scrape-style abuse.
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})
app.use('/api/v1/nurseries', publicLimiter)
app.use('/api/v1/areas', publicLimiter)
app.use('/api/v1/properties', publicLimiter)
app.use('/api/v1/overlays', publicLimiter)
app.use('/api/v1/schools', publicLimiter)
app.use('/api/v1/public', publicLimiter)

// Stripe webhook — MUST be before json body parser (needs raw body)
app.post(
  '/api/v1/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingWebhookHandler
)

// Body parsing — 8mb to support base64 photo uploads (~5MB image + base64 overhead)
app.use(express.json({ limit: '8mb' }))

// Optional auth — attaches req.user if a valid bearer token is present
app.use(optionalAuth)

// Track last_active_at for authenticated users (debounced — 1 hour)
const _lastActiveCache = new Map() // userId -> timestamp of last DB write
app.use((req, _res, next) => {
  if (!req.user?.id || !db) return next()
  const now = Date.now()
  const lastWrite = _lastActiveCache.get(req.user.id) || 0
  if (now - lastWrite < 3600_000) return next() // skip if <1 hour since last update
  _lastActiveCache.set(req.user.id, now)
  // Fire-and-forget — do not block the request
  db.from('user_profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', req.user.id)
    .then(() => {})
    .catch((err) => { logger.warn({ err: err?.message, userId: req.user.id }, 'last_active_at update failed') })
  return next()
})

// Routes
app.use('/api/v1/health', healthRouter)
app.use('/api/v1/profile', profileRouter)
app.use('/api/v1/nurseries', qaRouter)
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
app.use('/api/v1/admin/provider-invites', providerInvitesRouter)
app.use('/api/v1/admin/promotions', adminPromotionsRouter)
app.use('/api/v1/provider-auth', providerAuthRouter)
app.use('/api/v1/promotions', promotionsRouter)
app.use('/api/v1/provider', providerReportsRouter)
app.use('/api/v1/blog', blogRouter)
app.use('/api/v1/schools', schoolsRouter)

// Public OpenAPI spec for LLM agents + ChatGPT Custom GPT
app.get('/api/openapi.json', (req, res, next) => {
  try {
    res.json(openapi)
  } catch (err) {
    next(err)
  }
})

// Swagger UI — interactive API docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
  customSiteTitle: 'CompareTheNursery API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
}))

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
