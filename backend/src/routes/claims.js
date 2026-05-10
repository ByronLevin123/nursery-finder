// Nursery claims API — providers claim nurseries; admins approve/reject.
// User-scoped routes use Supabase JWT auth. Admin routes use basic auth.

import express from 'express'
import rateLimit from 'express-rate-limit'
import db from '../db.js'
import { requireAuth, requireVerifiedEmail, requireRole } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'
import { isEmailAvailable, sendEmail, renderClaimApprovedEmail } from '../services/emailService.js'

const router = express.Router()

const VALID_ROLES = ['Owner', 'Manager', 'Marketing', 'Other']

// Per-user claim submission limit. A real provider claims maybe 1-3 nurseries
// in a session (a nursery group might claim a small chain). 10/day per user
// is generous for legit use and a hard ceiling on claim spam.
const claimSubmissionLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Claim submission limit reached. Try again tomorrow.' },
})

function validateClaimBody(body) {
  if (!body || typeof body !== 'object') return 'invalid body'
  if (!body.urn || typeof body.urn !== 'string') return 'urn is required'
  if (
    !body.claimer_name ||
    typeof body.claimer_name !== 'string' ||
    body.claimer_name.length > 120
  ) {
    return 'claimer_name is required (up to 120 chars)'
  }
  if (
    !body.claimer_email ||
    typeof body.claimer_email !== 'string' ||
    body.claimer_email.length > 200
  ) {
    return 'claimer_email is required (up to 200 chars)'
  }
  if (body.claimer_role != null && !VALID_ROLES.includes(body.claimer_role)) {
    return `claimer_role must be one of ${VALID_ROLES.join(', ')}`
  }
  if (
    body.claimer_phone != null &&
    (typeof body.claimer_phone !== 'string' || body.claimer_phone.length > 40)
  ) {
    return 'claimer_phone must be a string up to 40 chars'
  }
  if (
    body.evidence_notes != null &&
    (typeof body.evidence_notes !== 'string' || body.evidence_notes.length > 4000)
  ) {
    return 'evidence_notes must be a string up to 4000 chars'
  }
  return null
}

// POST /api/v1/claims — submit a new claim
router.post(
  '/',
  requireAuth,
  requireVerifiedEmail,
  claimSubmissionLimiter,
  async (req, res, next) => {
    try {
      if (!db) return res.status(503).json({ error: 'Database not configured' })
      const err = validateClaimBody(req.body)
      if (err) return res.status(400).json({ error: err })

      // Verify URN exists
      const { data: nursery, error: nErr } = await db
        .from('nurseries')
        .select('urn, name')
        .eq('urn', req.body.urn)
        .maybeSingle()
      if (nErr) throw nErr
      if (!nursery) return res.status(404).json({ error: 'Nursery not found' })

      const row = {
        urn: req.body.urn,
        user_id: req.user.id,
        claimer_name: req.body.claimer_name,
        claimer_role: req.body.claimer_role || null,
        claimer_email: req.body.claimer_email,
        claimer_phone: req.body.claimer_phone || null,
        evidence_notes: req.body.evidence_notes || null,
        status: 'pending',
      }

      const { data, error } = await db.from('nursery_claims').insert(row).select().single()
      if (error) throw error

      logger.info({ userId: req.user.id, urn: row.urn, claimId: data.id }, 'claim submitted')
      return res.status(201).json(data)
    } catch (err) {
      next(err)
    }
  }
)

// GET /api/v1/claims/mine — user's own claims
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { data, error } = await db
      .from('nursery_claims')
      .select('*, nurseries(name, town)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/claims — admin list of all claims (optional ?status=)
router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    let q = db.from('nursery_claims').select('*').order('created_at', { ascending: false })
    if (req.query.status) q = q.eq('status', req.query.status)
    const { data, error } = await q
    if (error) throw error

    // Enrich with nursery name/town
    const urns = [...new Set((data || []).map((c) => c.urn).filter(Boolean))]
    let nurseryMap = {}
    if (urns.length > 0) {
      const { data: nurseries } = await db
        .from('nurseries')
        .select('urn, name, town')
        .in('urn', urns)
      for (const n of nurseries || []) {
        nurseryMap[n.urn] = { name: n.name, town: n.town }
      }
    }

    const enriched = (data || []).map((c) => ({
      ...c,
      nursery_name: nurseryMap[c.urn]?.name || null,
      nursery_town: nurseryMap[c.urn]?.town || null,
    }))

    return res.json({ data: enriched })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/claims/:id/approve — admin approves
router.post('/:id/approve', requireRole('admin'), async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { id } = req.params

    const { data: claim, error: cErr } = await db
      .from('nursery_claims')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (cErr) throw cErr
    if (!claim) return res.status(404).json({ error: 'Claim not found' })

    const now = new Date().toISOString()
    const { data: updated, error: uErr } = await db
      .from('nursery_claims')
      .update({
        status: 'approved',
        approved_by: claim.user_id,
        approved_at: now,
        admin_notes: req.body?.admin_notes || null,
      })
      .eq('id', id)
      .select()
      .single()
    if (uErr) throw uErr

    const { error: nErr } = await db
      .from('nurseries')
      .update({ claimed_by_user_id: claim.user_id, claimed_at: now })
      .eq('urn', claim.urn)
    if (nErr) throw nErr

    logger.info({ claimId: id, urn: claim.urn }, 'claim approved')

    // Fire-and-forget approval email — never block the response on mail
    if (isEmailAvailable() && claim.claimer_email) {
      try {
        const { data: nurseryRow } = await db
          .from('nurseries')
          .select('name, town')
          .eq('urn', claim.urn)
          .maybeSingle()
        const providerUrl = process.env.FRONTEND_URL
          ? `${process.env.FRONTEND_URL}/provider`
          : 'https://nurserymatch.com/provider'
        const rendered = renderClaimApprovedEmail(nurseryRow || { name: claim.urn }, providerUrl)
        await sendEmail({
          to: claim.claimer_email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        })
      } catch (mailErr) {
        logger.warn(
          { err: mailErr?.message, claimId: id },
          'claim approval email failed (non-fatal)'
        )
      }
    }

    return res.json(updated)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/claims/:id/reject — admin rejects
router.post('/:id/reject', requireRole('admin'), async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { id } = req.params
    const { data, error } = await db
      .from('nursery_claims')
      .update({
        status: 'rejected',
        admin_notes: req.body?.admin_notes || null,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Claim not found' })

    logger.info({ claimId: id }, 'claim rejected')
    return res.json(data)
  } catch (err) {
    next(err)
  }
})

export default router
