import express from 'express'
import { randomBytes, createHash } from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()
const MAX_KEYS_PER_ACCOUNT = 5

function generateApiKey() {
  const raw = 'nm_live_' + randomBytes(24).toString('hex')
  const hash = createHash('sha256').update(raw).digest('hex')
  const prefix = raw.slice(0, 16)
  return { raw, hash, prefix }
}

// POST /register — create developer account + first API key
router.post('/register', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { company_name, website_url, use_case } = req.body
    if (!company_name || typeof company_name !== 'string' || company_name.trim().length < 2) {
      return res.status(400).json({ error: 'company_name is required (min 2 characters)' })
    }

    const { data: existing } = await db
      .from('developer_accounts')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (existing) {
      return res.status(409).json({ error: 'Developer account already exists' })
    }

    const { data: account, error: accErr } = await db
      .from('developer_accounts')
      .insert({
        user_id: req.user.id,
        company_name: company_name.trim(),
        website_url: website_url || null,
        use_case: use_case || null,
      })
      .select()
      .single()

    if (accErr) throw accErr

    const key = generateApiKey()
    const { error: keyErr } = await db.from('developer_api_keys').insert({
      developer_id: account.id,
      key_hash: key.hash,
      key_prefix: key.prefix,
      label: 'Default',
    })

    if (keyErr) throw keyErr

    logger.info({ userId: req.user.id, developerId: account.id }, 'developer account created')

    res.status(201).json({
      account: {
        id: account.id,
        company_name: account.company_name,
        tier: account.tier,
        status: account.status,
      },
      api_key: key.raw,
      note: 'Save this key — it will not be shown again.',
    })
  } catch (err) {
    logger.error({ err: err.message }, 'developer: register failed')
    next(err)
  }
})

// GET /account — get developer account + keys + usage summary
router.get('/account', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data: account, error } = await db
      .from('developer_accounts')
      .select('id, company_name, website_url, use_case, tier, status, created_at')
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (error) throw error
    if (!account) return res.status(404).json({ error: 'No developer account found' })

    const { data: keys } = await db
      .from('developer_api_keys')
      .select('id, key_prefix, label, last_used_at, created_at, revoked_at')
      .eq('developer_id', account.id)
      .order('created_at', { ascending: false })

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const { data: usage } = await db
      .from('developer_api_usage')
      .select('date, request_count, api_key_id')
      .in(
        'api_key_id',
        (keys || []).map((k) => k.id)
      )
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: true })

    res.json({ account, keys: keys || [], usage: usage || [] })
  } catch (err) {
    logger.error({ err: err.message }, 'developer: account fetch failed')
    next(err)
  }
})

// POST /keys — generate a new API key
router.post('/keys', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data: account } = await db
      .from('developer_accounts')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!account) return res.status(404).json({ error: 'No developer account found' })

    const { data: existingKeys } = await db
      .from('developer_api_keys')
      .select('id')
      .eq('developer_id', account.id)
      .is('revoked_at', null)

    if ((existingKeys || []).length >= MAX_KEYS_PER_ACCOUNT) {
      return res
        .status(400)
        .json({ error: `Maximum ${MAX_KEYS_PER_ACCOUNT} active keys per account` })
    }

    const label = req.body.label || 'API Key'
    const key = generateApiKey()

    const { error: keyErr } = await db.from('developer_api_keys').insert({
      developer_id: account.id,
      key_hash: key.hash,
      key_prefix: key.prefix,
      label: typeof label === 'string' ? label.slice(0, 50) : 'API Key',
    })

    if (keyErr) throw keyErr

    logger.info({ developerId: account.id }, 'developer: new key generated')

    res.status(201).json({
      api_key: key.raw,
      prefix: key.prefix,
      note: 'Save this key — it will not be shown again.',
    })
  } catch (err) {
    logger.error({ err: err.message }, 'developer: key generation failed')
    next(err)
  }
})

// DELETE /keys/:id — revoke an API key
router.delete('/keys/:id', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data: account } = await db
      .from('developer_accounts')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!account) return res.status(404).json({ error: 'No developer account found' })

    const { data: key } = await db
      .from('developer_api_keys')
      .select('id')
      .eq('id', req.params.id)
      .eq('developer_id', account.id)
      .is('revoked_at', null)
      .maybeSingle()

    if (!key) return res.status(404).json({ error: 'Key not found or already revoked' })

    const { error } = await db
      .from('developer_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', key.id)

    if (error) throw error

    logger.info({ keyId: key.id, developerId: account.id }, 'developer: key revoked')
    res.json({ revoked: true })
  } catch (err) {
    logger.error({ err: err.message }, 'developer: key revoke failed')
    next(err)
  }
})

// GET /usage — usage stats for last 30 days
router.get('/usage', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data: account } = await db
      .from('developer_accounts')
      .select('id, tier')
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!account) return res.status(404).json({ error: 'No developer account found' })

    const { data: keys } = await db
      .from('developer_api_keys')
      .select('id')
      .eq('developer_id', account.id)

    const keyIds = (keys || []).map((k) => k.id)
    if (keyIds.length === 0) return res.json({ usage: [], total_30d: 0, tier: account.tier })

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const { data: usage } = await db
      .from('developer_api_usage')
      .select('date, request_count')
      .in('api_key_id', keyIds)
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: true })

    const total = (usage || []).reduce((sum, r) => sum + r.request_count, 0)

    res.json({ usage: usage || [], total_30d: total, tier: account.tier })
  } catch (err) {
    logger.error({ err: err.message }, 'developer: usage fetch failed')
    next(err)
  }
})

export default router
