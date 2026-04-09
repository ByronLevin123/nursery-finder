// Provider enquiry inbox — view and manage enquiries for owned nurseries.

import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()

const ALLOWED_TRANSITIONS = {
  sent: ['responded', 'visit_booked', 'declined'],
  opened: ['responded', 'visit_booked', 'declined'],
  responded: ['visit_booked', 'place_offered', 'declined'],
  visit_booked: ['place_offered', 'declined', 'responded'],
  place_offered: ['accepted', 'declined'],
}

// GET /api/v1/provider/enquiries — list enquiries for all nurseries owned by this user
router.get('/enquiries', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    // Get nurseries owned by this user
    const { data: nurseries, error: nErr } = await db
      .from('nurseries')
      .select('id, urn, name')
      .eq('claimed_by_user_id', req.user.id)
    if (nErr) throw nErr
    if (!nurseries || nurseries.length === 0) {
      return res.json({ data: [] })
    }

    const nurseryIds = nurseries.map((n) => n.id)
    const nurseryMap = Object.fromEntries(nurseries.map((n) => [n.id, n]))

    // Get enquiries for these nurseries
    const { data: enquiries, error: eErr } = await db
      .from('enquiries')
      .select('*')
      .in('nursery_id', nurseryIds)
      .order('sent_at', { ascending: false })
    if (eErr) throw eErr

    // Enrich with nursery info and parent email
    const enriched = (enquiries || []).map((e) => ({
      ...e,
      nursery: nurseryMap[e.nursery_id] || null,
    }))

    return res.json({ data: enriched })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/v1/provider/enquiries/:id — update enquiry status + notes
router.patch('/enquiries/:id', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    // Fetch the enquiry
    const { data: enquiry, error: eErr } = await db
      .from('enquiries')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()
    if (eErr) throw eErr
    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' })

    // Verify the caller owns the nursery
    const { data: nursery, error: nErr } = await db
      .from('nurseries')
      .select('claimed_by_user_id')
      .eq('id', enquiry.nursery_id)
      .maybeSingle()
    if (nErr) throw nErr
    if (!nursery || nursery.claimed_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this nursery' })
    }

    const update = {}
    if (req.body.status) {
      const allowed = ALLOWED_TRANSITIONS[enquiry.status]
      if (!allowed || !allowed.includes(req.body.status)) {
        return res.status(400).json({
          error: `Cannot transition from ${enquiry.status} to ${req.body.status}`,
        })
      }
      update.status = req.body.status
      if (req.body.status === 'responded' && !enquiry.responded_at) {
        update.responded_at = new Date().toISOString()
      }
    }
    if (req.body.provider_notes != null) {
      update.provider_notes = req.body.provider_notes
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    const { data, error } = await db
      .from('enquiries')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error

    logger.info(
      { userId: req.user.id, enquiryId: req.params.id, status: update.status },
      'provider updated enquiry'
    )
    return res.json(data)
  } catch (err) {
    next(err)
  }
})

export default router
