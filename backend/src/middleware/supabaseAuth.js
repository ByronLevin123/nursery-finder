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

function userFrom(supabaseUser) {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    // Supabase exposes email_confirmed_at on the user object once the user
    // has clicked the verification link. Used by requireVerifiedEmail below.
    email_confirmed_at: supabaseUser.email_confirmed_at || null,
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const token = extractToken(req)
    if (!token || !authClient) return next()
    const { data, error } = await authClient.auth.getUser(token)
    if (error || !data?.user) return next()
    req.user = userFrom(data.user)
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
    req.user = userFrom(data.user)
    return next()
  } catch (err) {
    logger.warn({ err: err?.message }, 'requireAuth failed')
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

/**
 * Block unverified accounts from write actions. Must be applied AFTER
 * requireAuth so req.user is populated. Returns 403 with a structured
 * error code so the frontend can show a "check your inbox" CTA rather
 * than a generic permission error.
 *
 * Used for enquiries, reviews, claims — anything where an unverified
 * account could spam real recipients (other parents, providers, admins).
 */
export function requireVerifiedEmail(req, res, next) {
  if (!req.user) {
    // Defense in depth — should never hit this when chained after requireAuth.
    return res.status(401).json({ error: 'Authentication required' })
  }
  if (req.user.email_confirmed_at) return next()
  return res.status(403).json({
    error: 'Please verify your email address before continuing.',
    code: 'email_not_verified',
    hint: 'We sent a confirmation link when you signed up — check your inbox (or spam folder).',
  })
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

export default { optionalAuth, requireAuth, requireVerifiedEmail, requireRole, requirePaidProvider }
