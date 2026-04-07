// Provider dashboard API — for users who own (claimed) nurseries.
// All routes require Supabase auth and verify ownership of the target nursery.

import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()

const EDITABLE_FIELDS = [
  'description',
  'opening_hours',
  'photos',
  'website_url',
  'contact_email',
  'contact_phone',
]

function validatePatch(patch) {
  if (!patch || typeof patch !== 'object') return 'invalid body'
  const keys = Object.keys(patch)
  for (const k of keys) {
    if (!EDITABLE_FIELDS.includes(k)) return `field not editable: ${k}`
  }
  if (
    patch.description != null &&
    (typeof patch.description !== 'string' || patch.description.length > 5000)
  ) {
    return 'description must be a string up to 5000 chars'
  }
  if (patch.opening_hours != null && typeof patch.opening_hours !== 'object') {
    return 'opening_hours must be an object'
  }
  // photos: array of URLs only — v2 will integrate Supabase storage for direct uploads
  if (patch.photos != null) {
    if (!Array.isArray(patch.photos) || patch.photos.length > 20) {
      return 'photos must be an array of up to 20 URLs'
    }
    if (!patch.photos.every((u) => typeof u === 'string' && u.length <= 500)) {
      return 'each photo must be a string URL up to 500 chars'
    }
  }
  if (
    patch.website_url != null &&
    (typeof patch.website_url !== 'string' || patch.website_url.length > 500)
  ) {
    return 'website_url must be a string up to 500 chars'
  }
  if (
    patch.contact_email != null &&
    (typeof patch.contact_email !== 'string' || patch.contact_email.length > 200)
  ) {
    return 'contact_email must be a string up to 200 chars'
  }
  if (
    patch.contact_phone != null &&
    (typeof patch.contact_phone !== 'string' || patch.contact_phone.length > 40)
  ) {
    return 'contact_phone must be a string up to 40 chars'
  }
  return null
}

// GET /api/v1/provider/nurseries — nurseries owned by the user
router.get('/nurseries', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { data, error } = await db
      .from('nurseries')
      .select('*')
      .eq('claimed_by_user_id', req.user.id)
      .order('name', { ascending: true })
    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/v1/provider/nurseries/:urn — update editable fields
router.patch('/nurseries/:urn', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const validationError = validatePatch(req.body)
    if (validationError) return res.status(400).json({ error: validationError })

    const { urn } = req.params
    const { data: nursery, error: nErr } = await db
      .from('nurseries')
      .select('urn, claimed_by_user_id')
      .eq('urn', urn)
      .maybeSingle()
    if (nErr) throw nErr
    if (!nursery) return res.status(404).json({ error: 'Nursery not found' })
    if (nursery.claimed_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this nursery' })
    }

    const update = {}
    for (const f of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, f)) update[f] = req.body[f]
    }
    update.provider_updated_at = new Date().toISOString()

    const { data, error } = await db
      .from('nurseries')
      .update(update)
      .eq('urn', urn)
      .select()
      .single()
    if (error) throw error

    logger.info(
      { userId: req.user.id, urn, fields: Object.keys(update) },
      'provider updated nursery'
    )
    return res.json(data)
  } catch (err) {
    next(err)
  }
})

export default router
