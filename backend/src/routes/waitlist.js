import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'
import { trackActivity } from '../services/activityTracker.js'

const router = express.Router()

// POST /api/v1/waitlist/join — parent joins a nursery waitlist
router.post('/join', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { nursery_id, nursery_urn, child_name, child_dob, age_group, notes } = req.body || {}

    if (!nursery_id && !nursery_urn) {
      return res.status(400).json({ error: 'nursery_id or nursery_urn required' })
    }

    // Resolve nursery
    let nursery
    if (nursery_urn) {
      const { data } = await db
        .from('nurseries')
        .select('id, urn, name')
        .eq('urn', nursery_urn)
        .maybeSingle()
      nursery = data
    } else {
      const { data } = await db
        .from('nurseries')
        .select('id, urn, name')
        .eq('id', nursery_id)
        .maybeSingle()
      nursery = data
    }

    if (!nursery) return res.status(404).json({ error: 'Nursery not found' })

    // Check if already on waitlist
    const { data: existing } = await db
      .from('waitlist_entries')
      .select('id')
      .eq('nursery_id', nursery.id)
      .eq('user_id', req.user.id)
      .eq('status', 'waiting')
      .maybeSingle()

    if (existing) {
      return res.status(409).json({ error: 'You are already on the waitlist for this nursery' })
    }

    const { data: entry, error } = await db
      .from('waitlist_entries')
      .insert({
        nursery_id: nursery.id,
        nursery_urn: nursery.urn,
        user_id: req.user.id,
        child_name: child_name || null,
        child_dob: child_dob || null,
        parent_email: req.user.email || null,
        age_group: age_group || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) throw error

    logger.info({ userId: req.user.id, nurseryId: nursery.id }, 'joined waitlist')
    trackActivity(req.user.id, 'waitlist_join', { targetUrn: nursery.urn, req })
    res.status(201).json({ data: entry, nursery_name: nursery.name })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/waitlist/mine — list my waitlist entries
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data, error } = await db
      .from('waitlist_entries')
      .select('*, nurseries(name, urn, town)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/waitlist/:id — cancel a waitlist entry
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { error } = await db
      .from('waitlist_entries')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/waitlist/nursery/:urn — provider views waitlist for their nursery
router.get('/nursery/:urn', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urn } = req.params

    // Verify ownership
    const { data: nursery } = await db
      .from('nurseries')
      .select('id, claimed_by_user_id')
      .eq('urn', urn)
      .maybeSingle()

    if (!nursery || nursery.claimed_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this nursery' })
    }

    const { data, error } = await db
      .from('waitlist_entries')
      .select('id, child_name, child_dob, parent_email, age_group, notes, status, created_at')
      .eq('nursery_id', nursery.id)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json({ data: data || [], total: (data || []).length })
  } catch (err) {
    next(err)
  }
})

export default router
