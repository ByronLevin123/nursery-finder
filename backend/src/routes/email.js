// Email routes — send shortlist / comparison / test emails via Resend.
// All user-facing routes require Supabase auth and are rate-limited.

import express from 'express'
import rateLimit from 'express-rate-limit'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { adminAuth } from '../middleware/auth.js'
import { logger } from '../logger.js'
import {
  sendEmail,
  renderShortlistEmail,
  renderComparisonEmail,
  isEmailAvailable,
  EmailNotConfiguredError,
} from '../services/emailService.js'

const router = express.Router()

// 5 emails per hour per authenticated user
const userEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Email rate limit reached, try again later' },
})

function validateBody(body) {
  if (!body || typeof body !== 'object') return 'invalid body'
  if (!body.to || typeof body.to !== 'string') return 'to (email) is required'
  if (!Array.isArray(body.urns) || body.urns.length === 0) return 'urns must be a non-empty array'
  if (body.urns.length > 50) return 'too many urns (max 50)'
  if (!body.urns.every((u) => typeof u === 'string')) return 'urns must be strings'
  return null
}

async function loadNurseriesByUrns(urns) {
  if (!db) return []
  const { data, error } = await db
    .from('nurseries')
    .select('urn,name,ofsted_overall_grade,town,postcode')
    .in('urn', urns)
  if (error) throw error
  return data || []
}

// POST /api/v1/email/shortlist
router.post('/shortlist', requireAuth, userEmailLimiter, async (req, res, next) => {
  try {
    if (!isEmailAvailable()) {
      return res.status(503).json({ error: 'Email service not configured' })
    }
    const validationError = validateBody(req.body)
    if (validationError) return res.status(400).json({ error: validationError })

    const nurseries = await loadNurseriesByUrns(req.body.urns)
    const { subject, html, text } = renderShortlistEmail({
      nurseries,
      userName: req.user?.email?.split('@')[0],
    })
    const result = await sendEmail({
      to: req.body.to,
      subject,
      html,
      text,
      replyTo: req.user?.email,
    })
    logger.info(
      { userId: req.user.id, count: nurseries.length, messageId: result.messageId },
      'shortlist email sent'
    )
    return res.json({ ok: true, messageId: result.messageId, count: nurseries.length })
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) {
      return res.status(503).json({ error: 'Email service not configured' })
    }
    next(err)
  }
})

// POST /api/v1/email/comparison
router.post('/comparison', requireAuth, userEmailLimiter, async (req, res, next) => {
  try {
    if (!isEmailAvailable()) {
      return res.status(503).json({ error: 'Email service not configured' })
    }
    const validationError = validateBody(req.body)
    if (validationError) return res.status(400).json({ error: validationError })

    const nurseries = await loadNurseriesByUrns(req.body.urns)
    const { subject, html, text } = renderComparisonEmail({
      nurseries,
      userName: req.user?.email?.split('@')[0],
    })
    const result = await sendEmail({
      to: req.body.to,
      subject,
      html,
      text,
      replyTo: req.user?.email,
    })
    logger.info(
      { userId: req.user.id, count: nurseries.length, messageId: result.messageId },
      'comparison email sent'
    )
    return res.json({ ok: true, messageId: result.messageId, count: nurseries.length })
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) {
      return res.status(503).json({ error: 'Email service not configured' })
    }
    next(err)
  }
})

// POST /api/v1/email/test — admin-only smoke test
router.post('/test', adminAuth, async (req, res, next) => {
  try {
    if (!isEmailAvailable()) {
      return res.status(503).json({ error: 'Email service not configured' })
    }
    const to = req.body?.to || process.env.ALERT_EMAIL
    if (!to) return res.status(400).json({ error: 'no recipient configured' })
    const result = await sendEmail({
      to,
      subject: 'CompareTheNursery email test',
      html: '<p>This is a test email from CompareTheNursery.</p>',
      text: 'This is a test email from CompareTheNursery.',
    })
    return res.json({ ok: true, messageId: result.messageId })
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) {
      return res.status(503).json({ error: 'Email service not configured' })
    }
    next(err)
  }
})

export default router
