// Provider invite routes — admin-only bulk outreach to unclaimed nurseries.

import express from 'express'
import rateLimit from 'express-rate-limit'
import db from '../db.js'
import { requireRole } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'
import { sendEmail, renderProviderInviteEmail, isEmailAvailable } from '../services/emailService.js'

const router = express.Router()

// Defense-in-depth: even though these endpoints are admin-only, cap outreach
// volume per admin to bound the blast radius of a compromised admin account.
// 200 invites/batch * 5 batches/hour = 1,000 invites/hour ceiling per admin.
const inviteSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Invite send limit reached. Try again in an hour.' },
})

// Every route requires admin role
router.use(requireRole('admin'))

// ---------------------------------------------------------------------------
// POST /preview — preview unclaimed nurseries matching criteria
// ---------------------------------------------------------------------------
router.post('/preview', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { region, local_authority, limit: rawLimit } = req.body || {}
    const limit = Math.min(500, Math.max(1, parseInt(rawLimit, 10) || 50))

    let query = db
      .from('nurseries')
      .select('urn, name, email, town, postcode, local_authority, region, ofsted_overall_grade')
      .is('claimed_by_user_id', null)
      .not('email', 'is', null)
      .neq('email', '')
      .order('name', { ascending: true })
      .limit(limit)

    if (region) {
      query = query.ilike('region', `%${region}%`)
    }
    if (local_authority) {
      query = query.ilike('local_authority', `%${local_authority}%`)
    }

    // Exclude nurseries already invited
    // We fetch already-invited URNs and filter client-side since Supabase JS
    // does not support NOT IN subqueries cleanly.
    const { data: alreadyInvited } = await db
      .from('provider_invites')
      .select('urn')

    const invitedUrns = new Set((alreadyInvited || []).map((r) => r.urn))

    const { data, error } = await query
    if (error) throw error

    const filtered = (data || []).filter((n) => !invitedUrns.has(n.urn))

    logger.info(
      { region, local_authority, limit, results: filtered.length },
      'provider invite preview'
    )
    return res.json({ data: filtered, meta: { total: filtered.length } })
  } catch (err) {
    logger.error({ err: err?.message }, 'provider invite preview failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /send — send invite emails to selected nurseries
// ---------------------------------------------------------------------------
router.post('/send', inviteSendLimiter, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urns } = req.body || {}
    if (!Array.isArray(urns) || urns.length === 0) {
      return res.status(400).json({ error: 'urns must be a non-empty array' })
    }
    if (urns.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 invites per batch' })
    }

    if (!isEmailAvailable()) {
      return res.status(503).json({ error: 'Email service not configured' })
    }

    // Fetch nursery details for the selected URNs
    const { data: nurseries, error: fetchErr } = await db
      .from('nurseries')
      .select('urn, name, email, town, postcode')
      .in('urn', urns)
      .not('email', 'is', null)
      .neq('email', '')

    if (fetchErr) throw fetchErr

    if (!nurseries || nurseries.length === 0) {
      return res.json({ sent: 0, failed: 0, skipped: urns.length })
    }

    let sent = 0
    let failed = 0
    const skipped = urns.length - nurseries.length

    // Fire-and-forget: send emails without blocking response
    const sendPromises = nurseries.map(async (nursery) => {
      try {
        const { subject, html, text } = renderProviderInviteEmail(nursery)
        await sendEmail({ to: nursery.email, subject, html, text })

        // Log to provider_invites table
        await db.from('provider_invites').insert({
          urn: nursery.urn,
          email: nursery.email,
          status: 'sent',
        })

        sent++
      } catch (err) {
        logger.warn(
          { err: err?.message, urn: nursery.urn },
          'provider invite email failed'
        )
        failed++
      }
    })

    await Promise.allSettled(sendPromises)

    logger.info(
      { sent, failed, skipped, by: req.user.id },
      'provider invite batch complete'
    )
    return res.json({ sent, failed, skipped })
  } catch (err) {
    logger.error({ err: err?.message }, 'provider invite send failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /stats — invite funnel statistics
// ---------------------------------------------------------------------------
router.get('/stats', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const [totalResult, openedResult, clickedResult, claimedResult] = await Promise.all([
      db.from('provider_invites').select('id', { count: 'exact', head: true }),
      db
        .from('provider_invites')
        .select('id', { count: 'exact', head: true })
        .in('status', ['opened', 'clicked', 'claimed']),
      db
        .from('provider_invites')
        .select('id', { count: 'exact', head: true })
        .in('status', ['clicked', 'claimed']),
      db
        .from('provider_invites')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'claimed'),
    ])

    const total = totalResult.count ?? 0
    const opened = openedResult.count ?? 0
    const clicked = clickedResult.count ?? 0
    const claimed = claimedResult.count ?? 0

    logger.info('provider invite stats fetched')
    return res.json({
      total_invited: total,
      opened,
      clicked,
      claimed,
      conversion_rate: total > 0 ? Math.round((claimed / total) * 10000) / 100 : 0,
    })
  } catch (err) {
    logger.error({ err: err?.message }, 'provider invite stats failed')
    next(err)
  }
})

export default router
