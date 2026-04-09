// Enquiries routes — multi-nursery enquiry submission and tracking.

import express from 'express'
import rateLimit from 'express-rate-limit'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { sendEmail, isEmailAvailable, escapeHtml } from '../services/emailService.js'
import { logger } from '../logger.js'

const router = express.Router()

// Rate limit: 10 enquiry submissions per hour per user
const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enquiries, please try again later' },
})

// POST /api/v1/enquiries — submit enquiries to multiple nurseries
router.post('/', requireAuth, enquiryLimiter, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { nursery_ids, child_name, child_dob, preferred_start, session_preference, message } = req.body

    if (!Array.isArray(nursery_ids) || nursery_ids.length === 0) {
      return res.status(400).json({ error: 'nursery_ids must be a non-empty array' })
    }
    if (nursery_ids.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 nurseries per enquiry batch' })
    }

    // Fetch nurseries to verify they exist and get contact details
    const { data: nurseries, error: nErr } = await db
      .from('nurseries')
      .select('id, urn, name, contact_email, email, claimed_by_user_id')
      .in('id', nursery_ids)
    if (nErr) throw nErr

    if (!nurseries || nurseries.length === 0) {
      return res.status(404).json({ error: 'No matching nurseries found' })
    }

    const created = []
    for (const nursery of nurseries) {
      const row = {
        user_id: req.user.id,
        nursery_id: nursery.id,
        child_name: child_name || null,
        child_dob: child_dob || null,
        preferred_start: preferred_start || null,
        session_preference: session_preference || null,
        message: message || null,
        status: 'sent',
      }

      const { data: enquiry, error: insertErr } = await db
        .from('enquiries')
        .insert(row)
        .select()
        .single()

      if (insertErr) {
        logger.warn({ error: insertErr.message, nurseryId: nursery.id }, 'enquiry insert failed')
        continue
      }

      created.push({ ...enquiry, nursery_name: nursery.name, nursery_urn: nursery.urn })

      // Try to email the nursery contact
      const contactEmail = nursery.contact_email || nursery.email
      if (contactEmail && isEmailAvailable()) {
        try {
          await sendEmail({
            to: contactEmail,
            subject: `New enquiry via NurseryFinder for ${nursery.name}`,
            html: `<p>A parent has enquired about a place at <strong>${escapeHtml(nursery.name)}</strong>.</p>
<p><strong>Child:</strong> ${escapeHtml(child_name || 'Not specified')}</p>
${child_dob ? `<p><strong>DOB:</strong> ${escapeHtml(child_dob)}</p>` : ''}
${preferred_start ? `<p><strong>Preferred start:</strong> ${escapeHtml(preferred_start)}</p>` : ''}
${message ? `<p><strong>Message:</strong> ${escapeHtml(message)}</p>` : ''}
<p>Log in to NurseryFinder to respond.</p>`,
            text: `New enquiry for ${nursery.name}\n\nChild: ${child_name || 'Not specified'}\n${message || ''}`,
            replyTo: req.user.email,
          })
        } catch (emailErr) {
          logger.warn({ err: emailErr.message, nurseryId: nursery.id }, 'enquiry email failed')
          // Non-fatal — enquiry is still created
        }
      }
    }

    logger.info(
      { userId: req.user.id, count: created.length, nurseries: nursery_ids.length },
      'enquiries submitted'
    )

    return res.status(201).json({
      data: created,
      meta: { sent: created.length, requested: nursery_ids.length },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/enquiries/mine — list user's enquiries with nursery info
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data, error } = await db
      .from('enquiries')
      .select('*, nurseries(name, urn, town)')
      .eq('user_id', req.user.id)
      .order('sent_at', { ascending: false })

    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

export default router
