// Provider visit slot management routes.

import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()

// Helper: verify caller owns the nursery
async function verifyOwnership(urn, userId) {
  if (!db) return { error: 'Database not configured', status: 503 }
  const { data: nursery, error } = await db
    .from('nurseries')
    .select('id, urn, claimed_by_user_id')
    .eq('urn', urn)
    .maybeSingle()
  if (error) throw error
  if (!nursery) return { error: 'Nursery not found', status: 404 }
  if (nursery.claimed_by_user_id !== userId) {
    return { error: 'You do not own this nursery', status: 403 }
  }
  return { nursery }
}

// GET /api/v1/provider/nurseries/:urn/slots — list all slots
router.get('/nurseries/:urn/slots', requireAuth, async (req, res, next) => {
  try {
    const check = await verifyOwnership(req.params.urn, req.user.id)
    if (check.error) return res.status(check.status).json({ error: check.error })

    const { data, error } = await db
      .from('visit_slots')
      .select('*')
      .eq('nursery_id', check.nursery.id)
      .order('slot_date', { ascending: true })
      .order('slot_time', { ascending: true })

    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/provider/nurseries/:urn/slots — create slots (supports bulk)
router.post('/nurseries/:urn/slots', requireAuth, async (req, res, next) => {
  try {
    const check = await verifyOwnership(req.params.urn, req.user.id)
    if (check.error) return res.status(check.status).json({ error: check.error })

    const { dates, time, duration_min, capacity } = req.body
    if (!Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'dates array is required' })
    }
    if (!time) return res.status(400).json({ error: 'time is required' })
    if (dates.length > 52) {
      return res.status(400).json({ error: 'Maximum 52 slots per request' })
    }

    const rows = dates.map((d) => ({
      nursery_id: check.nursery.id,
      slot_date: d,
      slot_time: time,
      duration_min: duration_min || 30,
      capacity: capacity || 1,
      booked: 0,
    }))

    const { data, error } = await db
      .from('visit_slots')
      .insert(rows)
      .select()

    if (error) throw error
    logger.info({ urn: req.params.urn, count: rows.length }, 'provider created visit slots')
    return res.status(201).json({ data })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/provider/nurseries/:urn/slots/:id — delete a slot
router.delete('/nurseries/:urn/slots/:id', requireAuth, async (req, res, next) => {
  try {
    const check = await verifyOwnership(req.params.urn, req.user.id)
    if (check.error) return res.status(check.status).json({ error: check.error })

    const { data: slot, error: sErr } = await db
      .from('visit_slots')
      .select('*')
      .eq('id', req.params.id)
      .eq('nursery_id', check.nursery.id)
      .maybeSingle()
    if (sErr) throw sErr
    if (!slot) return res.status(404).json({ error: 'Slot not found' })

    const { error } = await db
      .from('visit_slots')
      .delete()
      .eq('id', req.params.id)
    if (error) throw error

    logger.info({ urn: req.params.urn, slotId: req.params.id }, 'provider deleted visit slot')
    return res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

export default router
