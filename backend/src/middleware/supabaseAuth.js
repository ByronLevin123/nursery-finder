// Supabase JWT auth middleware
// optionalAuth attaches req.user if a valid bearer token is present, never blocks.
// requireAuth blocks with 401 if no valid user is attached.

import { createClient } from '@supabase/supabase-js'
import { logger } from '../logger.js'

let authClient = null

if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function extractToken(req) {
  const header = req.headers['authorization'] || req.headers['Authorization']
  if (!header || typeof header !== 'string') return null
  const parts = header.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null
  return parts[1]
}

export async function optionalAuth(req, _res, next) {
  try {
    const token = extractToken(req)
    if (!token || !authClient) return next()
    const { data, error } = await authClient.auth.getUser(token)
    if (error || !data?.user) return next()
    req.user = { id: data.user.id, email: data.user.email }
    return next()
  } catch (err) {
    logger.warn({ err: err?.message }, 'optionalAuth failed')
    return next()
  }
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req)
    if (!token || !authClient) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    const { data, error } = await authClient.auth.getUser(token)
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    req.user = { id: data.user.id, email: data.user.email }
    return next()
  } catch (err) {
    logger.warn({ err: err?.message }, 'requireAuth failed')
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

// requireRole(...roles) — requires authenticated user whose user_profiles.role is in the allowed set.
// Usage: requireRole('admin') or requireRole('provider','admin').
import db from '../db.js'
export function requireRole(...allowed) {
  return async function (req, res, next) {
    return requireAuth(req, res, async () => {
      try {
        if (!db) return res.status(503).json({ error: 'Database not configured' })
        const { data, error } = await db
          .from('user_profiles')
          .select('role')
          .eq('id', req.user.id)
          .maybeSingle()
        if (error) throw error
        const role = data?.role || 'customer'
        req.user.role = role
        if (!allowed.includes(role)) {
          return res.status(403).json({ error: 'Forbidden', required_role: allowed })
        }
        return next()
      } catch (err) {
        logger.warn({ err: err?.message }, 'requireRole failed')
        return res.status(500).json({ error: 'Role check failed' })
      }
    })
  }
}

// requirePaidProvider — verifies user has an active pro/premium provider subscription
// AND owns the nursery identified by req.params.urn.
// Attaches req.providerTier and req.tierLimits.
export function requirePaidProvider(req, res, next) {
  return requireAuth(req, res, async () => {
    try {
      if (!db) return res.status(503).json({ error: 'Database not configured' })

      const urn = req.params.urn
      if (!urn) return res.status(400).json({ error: 'Missing nursery URN' })

      // Check nursery ownership
      const { data: nursery, error: nErr } = await db
        .from('nurseries')
        .select('urn, claimed_by_user_id')
        .eq('urn', urn)
        .maybeSingle()
      if (nErr) throw nErr
      if (!nursery) return res.status(404).json({ error: 'Nursery not found' })
      if (nursery.claimed_by_user_id !== req.user.id) {
        return res.status(403).json({ error: 'You do not own this nursery' })
      }

      // Check provider subscription tier
      const { data: sub, error: sErr } = await db
        .from('provider_subscriptions')
        .select('tier, status')
        .eq('user_id', req.user.id)
        .maybeSingle()
      if (sErr) throw sErr

      const tier = sub?.tier || 'free'
      const isActive = !sub || sub.status === 'active' || sub.status === 'trialing'

      if (tier === 'free' || !isActive) {
        return res.status(403).json({
          error: 'This feature requires a Pro or Premium subscription',
          upgrade_url: '/provider/billing',
          current_tier: tier,
        })
      }

      // Fetch tier limits
      const { data: limits, error: lErr } = await db
        .from('tier_limits')
        .select('*')
        .eq('tier', tier)
        .maybeSingle()
      if (lErr) throw lErr

      req.providerTier = tier
      req.tierLimits = limits || {}
      return next()
    } catch (err) {
      logger.warn({ err: err?.message }, 'requirePaidProvider failed')
      return res.status(500).json({ error: 'Subscription check failed' })
    }
  })
}

export default { optionalAuth, requireAuth, requireRole, requirePaidProvider }
