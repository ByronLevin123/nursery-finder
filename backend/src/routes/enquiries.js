// Enquiries routes — multi-nursery enquiry submission and tracking.

import express from 'express'
import rateLimit from 'express-rate-limit'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import {
  sendEmail,
  isEmailAvailable,
  escapeHtml,
  renderEnquiryNotificationEmail,
} from '../services/emailService.js'
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

    const { nursery_ids, child_name, child_dob, preferred_start, session_preference, message } =
      req.body

    if (!Array.isArray(nursery_ids) || nursery_ids.length === 0) {
      return res.status(400).json({ error: 'nursery_ids must be a non-empty array' })
    }
    if (nursery_ids.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 nurseries per enquiry batch' })
    }

    // Fetch nurseries to verify they exist and get contact details
    const { data: nurseries, error: nErr } = await db
      .from('nurseries')
      .select(
        'id, urn, name, contact_email, email, claimed_by_user_id, nursery_claims(claimer_email)'
      )
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

      // Try to email the nursery contact (branded template)
      const claimerEmail =
        Array.isArray(nursery.nursery_claims) && nursery.nursery_claims.length > 0
          ? nursery.nursery_claims[0].claimer_email
          : null
      const contactEmail = claimerEmail || nursery.contact_email || nursery.email
      if (contactEmail && isEmailAvailable()) {
        try {
          // Compute child age in months from DOB
          let childAgeMonths = null
          if (child_dob) {
            const dob = new Date(child_dob)
            const now = new Date()
            childAgeMonths =
              (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth())
            if (childAgeMonths < 0) childAgeMonths = null
          }

          const frontendUrl = process.env.FRONTEND_URL || 'https://comparethenursery.com'
          const rendered = renderEnquiryNotificationEmail({
            nurseryName: nursery.name,
            parentName: req.user.email,
            childName: child_name,
            childAgeMonths,
            preferredStart: preferred_start,
            sessionPreference: session_preference,
            message,
            providerUrl: `${frontendUrl}/provider`,
          })

          await sendEmail({
            to: contactEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            replyTo: req.user.email,
          })
          logger.info({ nurseryId: nursery.id }, 'enquiry notification email sent')
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
