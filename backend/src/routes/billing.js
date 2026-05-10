// Billing routes — Stripe checkout, portal, subscription queries, webhook
// Webhook route is exported separately and mounted with express.raw() in app.js

import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'
import {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  getProviderSubscription,
} from '../services/stripeService.js'

const router = express.Router()

function stripeGuard(_req, res, next) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe not configured' })
  }
  next()
}

// GET /api/v1/billing/subscription — returns current user's subscription
router.get('/subscription', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    // Check role to determine which table to query
    const { data: profile } = await db
      .from('user_profiles')
      .select('role')
      .eq('id', req.user.id)
      .maybeSingle()

    const role = profile?.role || 'customer'

    if (role === 'provider' || role === 'admin') {
      const sub = await getProviderSubscription(req.user.id)
      return res.json({ type: 'provider', subscription: sub })
    }

    // Parents use everything free — no subscription needed
    res.json({ type: 'parent', subscription: { tier: 'free', status: 'active' } })
  } catch (err) {
    logger.error({ err: err.message, userId: req.user.id }, 'billing: subscription fetch failed')
    next(err)
  }
})

// POST /api/v1/billing/checkout — create Stripe checkout session
router.post('/checkout', requireAuth, stripeGuard, async (req, res, next) => {
  try {
    const { tier, type, successUrl, cancelUrl } = req.body
    if (!tier) {
      return res.status(400).json({ error: 'tier is required' })
    }
    if (type && type !== 'provider') {
      return res
        .status(400)
        .json({ error: 'Only provider subscriptions are supported. Parents use everything free.' })
    }
    if (!['pro', 'premium'].includes(tier)) {
      return res.status(400).json({ error: 'tier must be pro or premium' })
    }

    const result = await createCheckoutSession({
      userId: req.user.id,
      email: req.user.email,
      tier,
      type: 'provider',
      successUrl,
      cancelUrl,
    })

    logger.info({ userId: req.user.id, tier, type }, 'billing: checkout session created')
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message, userId: req.user.id }, 'billing: checkout failed')
    next(err)
  }
})

// POST /api/v1/billing/portal — create Stripe billing portal session
router.post('/portal', requireAuth, stripeGuard, async (req, res, next) => {
  try {
    const result = await createPortalSession({ userId: req.user.id })
    logger.info({ userId: req.user.id }, 'billing: portal session created')
    res.json(result)
  } catch (err) {
    if (err.message?.includes('No subscription found')) {
      return res.status(404).json({ error: 'No active subscription found' })
    }
    logger.error({ err: err.message, userId: req.user.id }, 'billing: portal failed')
    next(err)
  }
})

// GET /api/v1/billing/tiers — public, returns tier_limits table
router.get('/tiers', async (_req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { data, error } = await db.from('tier_limits').select('*')
    if (error) throw error
    res.json({ data })
  } catch (err) {
    logger.error({ err: err.message }, 'billing: tiers fetch failed')
    next(err)
  }
})

// Webhook handler — exported separately, mounted with express.raw() in app.js
export async function billingWebhookHandler(req, res) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Stripe not configured' })
    }
    const signature = req.headers['stripe-signature']
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' })
    }
    const result = await handleWebhook(req.body, signature)
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'billing: webhook processing failed')
    res.status(400).json({ error: err.message })
  }
}

export default router
