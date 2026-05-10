// Auth routes — backend-mediated password login with email-keyed lockout.
//
// Why mediate? Supabase's built-in rate limit is per-IP (~30/hr). It does
// not protect against an attacker rotating IPs to brute-force a single
// account. By posting to our backend first we can also lock per-email,
// then forward to Supabase only if the email isn't locked out.
//
// Magic-link, OAuth, sign-up and password-reset flows still go directly to
// Supabase from the client — those are either rate-limited per-IP only by
// Supabase or are not credential-based.
//
// Lockout state is in-memory per process. With Render's single-instance
// Starter tier this is enough; if we scale to multiple instances we'll
// need a shared store (Redis or Supabase row).

import express from 'express'
import { logger } from '../logger.js'

const router = express.Router()

const FAILURE_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 5
const SWEEP_INTERVAL_MS = 5 * 60 * 1000
const ENTRY_TTL_MS = 60 * 60 * 1000

/** @type {Map<string, { count: number, firstAt: number, lastAt: number }>} */
const failureCounts = new Map()

// Background sweep — drop entries older than 1 hour so the Map doesn't grow.
const sweep = setInterval(() => {
  const cutoff = Date.now() - ENTRY_TTL_MS
  for (const [key, entry] of failureCounts.entries()) {
    if (entry.lastAt < cutoff) failureCounts.delete(key)
  }
}, SWEEP_INTERVAL_MS)
// Don't keep the process alive in tests just because of this timer.
if (sweep.unref) sweep.unref()

function getLockoutState(email) {
  const key = String(email || '').toLowerCase()
  if (!key) return { locked: false, remaining: MAX_FAILURES }
  const e = failureCounts.get(key)
  if (!e) return { locked: false, remaining: MAX_FAILURES }
  const now = Date.now()
  // Window expired since first failure → reset.
  if (now - e.firstAt > FAILURE_WINDOW_MS) {
    failureCounts.delete(key)
    return { locked: false, remaining: MAX_FAILURES }
  }
  const remaining = Math.max(0, MAX_FAILURES - e.count)
  if (remaining > 0) return { locked: false, remaining }
  // Locked. Retry_after = window from last failure (so further attempts
  // extend the lockout — punishes bots, costs humans nothing if they wait).
  const retry = Math.max(0, Math.ceil((e.lastAt + FAILURE_WINDOW_MS - now) / 1000))
  return { locked: true, retry_after_seconds: retry }
}

function recordFailure(email) {
  const key = String(email || '').toLowerCase()
  if (!key) return
  const now = Date.now()
  const e = failureCounts.get(key)
  if (!e || now - e.firstAt > FAILURE_WINDOW_MS) {
    failureCounts.set(key, { count: 1, firstAt: now, lastAt: now })
    return
  }
  e.count += 1
  e.lastAt = now
}

function recordSuccess(email) {
  failureCounts.delete(String(email || '').toLowerCase())
}

// Test seam — exposed so unit tests can clear state between cases.
export function _resetLoginLockoutStateForTests() {
  failureCounts.clear()
}

// POST /api/v1/auth/login — mediated password login.
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const lockout = getLockoutState(email)
    if (lockout.locked) {
      return res.status(429).json({
        error: 'Too many failed login attempts. Please try again later.',
        code: 'login_lockout',
        retry_after_seconds: lockout.retry_after_seconds,
      })
    }

    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(503).json({ error: 'Auth not configured' })
    }

    const upstream = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (upstream.ok) {
      recordSuccess(email)
      const data = await upstream.json()
      return res.json(data)
    }

    // Auth failure path — count the attempt, return Supabase's error
    // verbatim (so the frontend can keep its existing error display).
    recordFailure(email)
    const errBody = await upstream.json().catch(() => ({}))
    const after = getLockoutState(email)
    const status = upstream.status === 400 ? 401 : upstream.status
    return res.status(status).json({
      error: errBody.error_description || errBody.msg || 'Invalid email or password',
      code: errBody.error_code || errBody.error || 'invalid_credentials',
      attempts_remaining: after.remaining,
    })
  } catch (err) {
    logger.error({ err: err?.message }, 'auth/login mediator failed')
    return next(err)
  }
})

// GET /api/v1/auth/lockout?email=xxx — lightweight check the frontend can
// call to render an "X attempts left" hint without actually trying to log in.
router.get('/lockout', (req, res) => {
  const email = String(req.query.email || '')
  if (!email) return res.status(400).json({ error: 'email required' })
  const state = getLockoutState(email)
  res.json(state)
})

export default router
