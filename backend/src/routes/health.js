import express from 'express'
import db from '../db.js'

const router = express.Router()

/**
 * Per-dependency check. Returns one of:
 *   { status: 'ok',          ...metadata }
 *   { status: 'unconfigured', message: '...' }
 *   { status: 'error',        error: '...' }
 *
 * Health summary is `ok` only if every required check is `ok` or
 * `unconfigured` (an unset optional dep doesn't fail health). Any `error`
 * → 503. Use `required` to mark a dep as launch-blocking.
 */

const TIMEOUT_MS = 3000

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
    ),
  ])
}

async function checkDatabase() {
  if (!db) return { status: 'unconfigured', message: 'SUPABASE_URL/SERVICE_KEY not set' }
  try {
    const { count } = await withTimeout(
      db.from('nurseries').select('*', { count: 'exact', head: true }).eq('registration_status', 'Active'),
      'database'
    )
    const { count: geocoded } = await withTimeout(
      db
        .from('nurseries')
        .select('*', { count: 'exact', head: true })
        .eq('registration_status', 'Active')
        .not('lat', 'is', null),
      'database'
    )
    return { status: 'ok', nursery_count: count, geocoded_count: geocoded }
  } catch (err) {
    return { status: 'error', error: err.message }
  }
}

async function checkResend() {
  if (!process.env.RESEND_API_KEY) {
    return { status: 'unconfigured', message: 'RESEND_API_KEY not set — email disabled' }
  }
  try {
    // Lightweight check: list domains. 200 == reachable + key valid.
    const res = await withTimeout(
      fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      }),
      'resend'
    )
    if (res.status === 401 || res.status === 403) {
      return { status: 'error', error: `Resend auth failed (${res.status})` }
    }
    if (!res.ok) return { status: 'error', error: `Resend HTTP ${res.status}` }
    return { status: 'ok' }
  } catch (err) {
    return { status: 'error', error: err.message }
  }
}

async function checkStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { status: 'unconfigured', message: 'STRIPE_SECRET_KEY not set — billing disabled' }
  }
  try {
    // Cheapest authenticated call: GET /v1/balance. 200 confirms key is valid.
    const res = await withTimeout(
      fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      }),
      'stripe'
    )
    if (res.status === 401) return { status: 'error', error: 'Stripe auth failed (401)' }
    if (!res.ok) return { status: 'error', error: `Stripe HTTP ${res.status}` }
    return { status: 'ok' }
  } catch (err) {
    return { status: 'error', error: err.message }
  }
}

router.get('/', async (req, res) => {
  const [database, resend, stripe] = await Promise.all([
    checkDatabase(),
    checkResend(),
    checkStripe(),
  ])

  // Overall health: any 'error' from a required dep flips the response to 503.
  // 'unconfigured' is treated as ok — a dev environment without Resend or
  // Stripe should still report green for deploy gating.
  const required = { database }
  const hasError = Object.values(required).some((c) => c.status === 'error')

  const body = {
    status: hasError ? 'error' : 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks: { database, resend, stripe },
    // Backward-compat: legacy fields some monitors might still parse
    database: database.status === 'ok' ? 'connected' : database.status,
    nursery_count: database.nursery_count ?? 0,
    geocoded_count: database.geocoded_count ?? 0,
  }

  res.status(hasError ? 503 : 200).json(body)
})

export default router
