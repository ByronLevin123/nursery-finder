import express from 'express'
import db from '../db.js'
import { requireRole } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()

router.use(requireRole('admin'))

const TIMEOUT_MS = 5000

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
    ),
  ])
}

async function timed(label, fn) {
  const start = Date.now()
  try {
    const result = await withTimeout(fn(), label)
    return { ...result, latency_ms: Date.now() - start }
  } catch (err) {
    return { status: 'error', error: err.message, latency_ms: Date.now() - start }
  }
}

async function checkSupabase() {
  if (!db) return { status: 'unconfigured', message: 'SUPABASE_URL not set' }
  const { count, error } = await db
    .from('nurseries')
    .select('*', { count: 'exact', head: true })
    .eq('registration_status', 'Active')
  if (error) return { status: 'error', error: error.message }
  return { status: 'ok', detail: `${count} active nurseries` }
}

async function checkResend() {
  if (!process.env.RESEND_API_KEY) return { status: 'unconfigured', message: 'RESEND_API_KEY not set' }
  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  })
  if (res.status === 401 || res.status === 403) return { status: 'error', error: `Auth failed (${res.status})` }
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }
  return { status: 'ok' }
}

async function checkStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return { status: 'unconfigured', message: 'STRIPE_SECRET_KEY not set' }
  const res = await fetch('https://api.stripe.com/v1/balance', {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  })
  if (res.status === 401) return { status: 'error', error: 'Auth failed (401)' }
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }
  return { status: 'ok' }
}

async function checkPostcodesIo() {
  const res = await fetch('https://api.postcodes.io/postcodes/SW1A1AA')
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }
  const body = await res.json()
  if (body.status !== 200) return { status: 'error', error: 'Unexpected response' }
  return { status: 'ok' }
}

async function checkOsrm() {
  const url = process.env.OSRM_URL || 'https://router.project-osrm.org'
  const res = await fetch(`${url}/route/v1/foot/-0.1278,51.5074;-0.1300,51.5080?overview=false`)
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }
  const body = await res.json()
  if (body.code !== 'Ok') return { status: 'error', error: `OSRM code: ${body.code}` }
  return { status: 'ok' }
}

async function checkGooglePlaces() {
  if (!process.env.GOOGLE_PLACES_API_KEY) return { status: 'unconfigured', message: 'GOOGLE_PLACES_API_KEY not set' }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.displayName',
    },
    body: JSON.stringify({ textQuery: 'nursery London', maxResultCount: 1 }),
  })
  if (res.status === 403 || res.status === 401) return { status: 'error', error: `Auth failed (${res.status})` }
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }
  return { status: 'ok' }
}

async function checkPoliceApi() {
  const res = await fetch('https://data.police.uk/api/crime-categories')
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }
  return { status: 'ok' }
}

async function checkEnvironmentAgency() {
  const res = await fetch('https://environment.data.gov.uk/flood-monitoring/id/floodAreas?lat=51.5&long=-0.12&dist=2')
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }
  return { status: 'ok' }
}

async function checkPropertyData() {
  if (!process.env.PROPERTYDATA_API_KEY) return { status: 'unconfigured', message: 'PROPERTYDATA_API_KEY not set' }
  const res = await fetch(`https://api.propertydata.co.uk/prices?key=${process.env.PROPERTYDATA_API_KEY}&postcode=SW1A1AA`)
  if (res.status === 401 || res.status === 403) return { status: 'error', error: `Auth failed (${res.status})` }
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }
  return { status: 'ok' }
}

async function checkLandRegistry() {
  const res = await fetch('https://price-paid-data.publicdata.landregistry.gov.uk/pp-2024.csv', {
    method: 'HEAD',
  })
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }
  return { status: 'ok' }
}

async function checkOfsted() {
  const res = await fetch('https://www.gov.uk/government/statistical-data-sets/childcare-providers-and-inspections-management-information', {
    headers: { 'User-Agent': 'NurseryMatch/1.0 (status check)' },
  })
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }
  return { status: 'ok' }
}

async function checkAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return { status: 'unconfigured', message: 'ANTHROPIC_API_KEY not set' }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  })
  if (res.status === 401) return { status: 'error', error: 'Auth failed (401)' }
  if (!res.ok && res.status !== 429) return { status: 'error', error: `HTTP ${res.status}` }
  return { status: 'ok' }
}

async function checkTurnstile() {
  if (!process.env.TURNSTILE_SECRET_KEY) return { status: 'unconfigured', message: 'TURNSTILE_SECRET_KEY not set' }
  return { status: 'ok', detail: 'Key configured' }
}

async function checkSentry() {
  if (!process.env.SENTRY_DSN) return { status: 'unconfigured', message: 'SENTRY_DSN not set' }
  return { status: 'ok', detail: 'DSN configured' }
}

async function checkPlausible() {
  const res = await fetch('https://plausible.io/js/script.js', { method: 'HEAD' })
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }
  return { status: 'ok' }
}

const SERVICE_CHECKS = [
  { name: 'Supabase (Database)', category: 'core', fn: checkSupabase },
  { name: 'Resend (Email)', category: 'core', fn: checkResend },
  { name: 'Stripe (Payments)', category: 'core', fn: checkStripe },
  { name: 'Postcodes.io', category: 'data', fn: checkPostcodesIo },
  { name: 'OSRM (Routing)', category: 'data', fn: checkOsrm },
  { name: 'Google Places', category: 'data', fn: checkGooglePlaces },
  { name: 'Police API', category: 'data', fn: checkPoliceApi },
  { name: 'Environment Agency', category: 'data', fn: checkEnvironmentAgency },
  { name: 'PropertyData', category: 'data', fn: checkPropertyData },
  { name: 'Land Registry', category: 'data', fn: checkLandRegistry },
  { name: 'Ofsted (GOV.UK)', category: 'data', fn: checkOfsted },
  { name: 'Anthropic Claude', category: 'ai', fn: checkAnthropic },
  { name: 'Cloudflare Turnstile', category: 'security', fn: checkTurnstile },
  { name: 'Sentry', category: 'monitoring', fn: checkSentry },
  { name: 'Plausible Analytics', category: 'analytics', fn: checkPlausible },
]

router.get('/', async (req, res, next) => {
  try {
    const results = await Promise.all(
      SERVICE_CHECKS.map(async ({ name, category, fn }) => {
        const result = await timed(name, fn)
        return { name, category, ...result }
      })
    )

    const ok = results.filter((r) => r.status === 'ok').length
    const unconfigured = results.filter((r) => r.status === 'unconfigured').length
    const errors = results.filter((r) => r.status === 'error').length

    logger.info({ ok, unconfigured, errors }, 'admin status check completed')

    res.json({
      timestamp: new Date().toISOString(),
      summary: { total: results.length, ok, unconfigured, errors },
      services: results,
    })
  } catch (err) {
    logger.error({ err: err.message }, 'admin status check failed')
    next(err)
  }
})

export default router
