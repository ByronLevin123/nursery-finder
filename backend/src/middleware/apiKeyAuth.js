import { createHash } from 'crypto'
import db from '../db.js'
import { logger } from '../logger.js'

const TIER_DAILY_LIMITS = {
  free: 1_000,
  pro: 10_000,
  enterprise: 100_000,
}

const keyCache = new Map()
const KEY_CACHE_TTL = 60_000

function hashKey(raw) {
  return createHash('sha256').update(raw).digest('hex')
}

async function lookupKey(hash) {
  const cached = keyCache.get(hash)
  if (cached && Date.now() - cached.ts < KEY_CACHE_TTL) return cached.value

  const { data, error } = await db
    .from('developer_api_keys')
    .select('id, developer_id, revoked_at, developer_accounts(tier, status)')
    .eq('key_hash', hash)
    .maybeSingle()

  if (error) {
    logger.warn({ err: error.message }, 'apiKeyAuth: lookup failed')
    return null
  }

  const value = data || null
  keyCache.set(hash, { value, ts: Date.now() })
  return value
}

async function getDailyUsage(keyId) {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await db
    .from('developer_api_usage')
    .select('request_count')
    .eq('api_key_id', keyId)
    .eq('date', today)
    .maybeSingle()
  return data?.request_count || 0
}

function incrementUsage(keyId) {
  const today = new Date().toISOString().split('T')[0]
  Promise.resolve(db.rpc('increment_developer_usage', { p_key_id: keyId, p_date: today })).catch((err) => {
    logger.warn({ err: err?.message, keyId }, 'apiKeyAuth: usage increment failed')
  })
  db.from('developer_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyId)
    .then(() => {})
    .catch(() => {})
}

export function apiKeyAuth(req, _res, next) {
  if (!db) return next()

  const raw = req.headers['x-api-key'] || req.query.api_key
  if (!raw) return next()

  const hash = hashKey(raw)

  lookupKey(hash)
    .then(async (record) => {
      if (!record) {
        return _res.status(401).json({ error: 'Invalid API key' })
      }
      if (record.revoked_at) {
        return _res.status(401).json({ error: 'API key has been revoked' })
      }
      const account = record.developer_accounts
      if (!account || account.status !== 'active') {
        return _res.status(403).json({ error: 'Developer account is suspended' })
      }

      const tier = account.tier || 'free'
      const dailyLimit = TIER_DAILY_LIMITS[tier] || TIER_DAILY_LIMITS.free
      const used = await getDailyUsage(record.id)

      if (used >= dailyLimit) {
        return _res.status(429).json({
          error: 'Daily API limit exceeded',
          limit: dailyLimit,
          used,
          tier,
        })
      }

      req.apiKey = { id: record.id, developerId: record.developer_id, tier }
      req.apiKeyAuthenticated = true
      incrementUsage(record.id)
      next()
    })
    .catch((err) => {
      logger.error({ err: err?.message }, 'apiKeyAuth: unexpected error')
      next()
    })
}
