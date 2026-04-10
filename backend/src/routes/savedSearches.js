// Saved searches API — CRUD over saved_searches table.
// All routes require Supabase auth; RLS enforces row ownership.

import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()

// GET /api/v1/saved-searches
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { data, error } = await db
      .from('saved_searches')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/saved-searches
router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const body = req.body || {}
    if (body.criteria != null && typeof body.criteria !== 'object') {
      return res.status(400).json({ error: 'criteria must be an object' })
    }
    if (body.name != null && (typeof body.name !== 'string' || body.name.length > 120)) {
      return res.status(400).json({ error: 'name must be a string up to 120 chars' })
    }
    const row = {
      user_id: req.user.id,
      name: body.name || null,
      criteria: body.criteria || {},
      postcode: body.postcode || (body.criteria && body.criteria.postcode) || '',
      alert_on_new: body.alert_on_new === true,
    }
    const { data, error } = await db.from('saved_searches').insert(row).select().single()
    if (error) throw error
    logger.info({ userId: req.user.id, id: data.id }, 'saved search created')
    return res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/v1/saved-searches/:id — toggle alert_on_new (and other mutable fields)
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const body = req.body || {}
    const updates = {}
    if (typeof body.alert_on_new === 'boolean') updates.alert_on_new = body.alert_on_new
    if (typeof body.name === 'string') updates.name = body.name.slice(0, 120)
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }
    const { data, error } = await db
      .from('saved_searches')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Saved search not found' })
    logger.info({ userId: req.user.id, id: data.id, updates }, 'saved search updated')
    return res.json(data)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/saved-searches/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { error } = await db
      .from('saved_searches')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
    if (error) throw error
    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
