// Provider dashboard API — for users who own (claimed) nurseries.
// All routes require Supabase auth and verify ownership of the target nursery.

import express from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth, requirePaidProvider } from '../middleware/supabaseAuth.js'
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

// Fields that free-tier providers can edit (contact info only)
const FREE_EDITABLE_FIELDS = [
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

// GET /api/v1/provider/features — returns current user's tier feature flags
router.get('/features', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    // Get subscription
    const { data: sub, error: sErr } = await db
      .from('provider_subscriptions')
      .select('tier, status')
      .eq('user_id', req.user.id)
      .maybeSingle()
    if (sErr) throw sErr

    const tier = sub?.tier || 'free'
    const isActive = !sub || sub.status === 'active' || sub.status === 'trialing'
    const effectiveTier = isActive ? tier : 'free'

    // Get tier limits
    const { data: limits, error: lErr } = await db
      .from('tier_limits')
      .select('*')
      .eq('tier', effectiveTier)
      .maybeSingle()
    if (lErr) throw lErr

    return res.json({
      tier: effectiveTier,
      can_edit_description: limits?.custom_description || false,
      can_upload_photos: limits?.photo_gallery || false,
      can_manage_fees: limits?.fee_management || false,
      photo_limit: (limits?.photo_gallery) ? 20 : 0,
      featured_listing: limits?.featured_listing || false,
      analytics_advanced: limits?.analytics_advanced || false,
      priority_search: limits?.priority_search || false,
      custom_branding: limits?.custom_branding || false,
    })
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

    // Check tier for description editing
    let allowedFields = EDITABLE_FIELDS
    if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
      const { data: sub } = await db
        .from('provider_subscriptions')
        .select('tier, status')
        .eq('user_id', req.user.id)
        .maybeSingle()
      const tier = sub?.tier || 'free'
      const isActive = !sub || sub.status === 'active' || sub.status === 'trialing'
      if (tier === 'free' || !isActive) {
        allowedFields = FREE_EDITABLE_FIELDS
        // Strip description from body — free users cannot edit it
        if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
          return res.status(403).json({
            error: 'Custom description requires a Pro or Premium subscription',
            upgrade_url: '/provider/billing',
          })
        }
      }
    }

    const update = {}
    for (const f of allowedFields) {
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

// ─── Photo Gallery Endpoints ─────────────────────────────────────────────────

const MAX_PHOTOS = 20
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const STORAGE_BUCKET = 'nursery-photos'

function parseBase64Image(dataUri) {
  const match = dataUri.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) return null
  const mimeType = match[1]
  const base64Data = match[2]
  const buffer = Buffer.from(base64Data, 'base64')
  const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1]
  return { mimeType, buffer, ext }
}

// GET /api/v1/provider/nurseries/:urn/photos — public, no auth
router.get('/nurseries/:urn/photos', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { urn } = req.params
    const { data, error } = await db
      .from('nursery_photos')
      .select('*')
      .eq('nursery_urn', urn)
      .order('display_order', { ascending: true })
    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/provider/nurseries/:urn/photos — upload a photo (paid only)
router.post('/nurseries/:urn/photos', requirePaidProvider, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urn } = req.params
    const { image, caption } = req.body

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'image field required (base64 data URI)' })
    }

    const parsed = parseBase64Image(image)
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid image format. Use data:image/{type};base64,{data}' })
    }
    if (!ALLOWED_IMAGE_TYPES.includes(parsed.mimeType)) {
      return res.status(400).json({ error: `Unsupported image type: ${parsed.mimeType}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}` })
    }
    if (parsed.buffer.length > MAX_PHOTO_SIZE_BYTES) {
      return res.status(400).json({ error: `Image too large. Max ${MAX_PHOTO_SIZE_BYTES / 1024 / 1024}MB` })
    }

    // Check current photo count
    const { count, error: cErr } = await db
      .from('nursery_photos')
      .select('id', { count: 'exact', head: true })
      .eq('nursery_urn', urn)
    if (cErr) throw cErr
    if (count >= MAX_PHOTOS) {
      return res.status(400).json({ error: `Maximum ${MAX_PHOTOS} photos per nursery` })
    }

    // Upload to Supabase Storage
    const fileId = crypto.randomUUID()
    const storagePath = `${urn}/${fileId}.${parsed.ext}`

    const { error: uploadErr } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, parsed.buffer, {
        contentType: parsed.mimeType,
        upsert: false,
      })
    if (uploadErr) {
      logger.error({ err: uploadErr.message, urn, storagePath }, 'Photo upload to storage failed')
      throw uploadErr
    }

    // Get public URL
    const { data: urlData } = db.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
    const publicUrl = urlData?.publicUrl || ''

    // Insert DB record
    const { data: photo, error: insertErr } = await db
      .from('nursery_photos')
      .insert({
        nursery_urn: urn,
        storage_path: storagePath,
        public_url: publicUrl,
        display_order: count || 0,
        caption: caption || null,
      })
      .select()
      .single()
    if (insertErr) throw insertErr

    logger.info({ userId: req.user.id, urn, photoId: photo.id }, 'Photo uploaded')
    return res.status(201).json(photo)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/provider/nurseries/:urn/photos/:photoId — delete a photo (paid only)
router.delete('/nurseries/:urn/photos/:photoId', requirePaidProvider, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urn, photoId } = req.params

    // Find the photo
    const { data: photo, error: fErr } = await db
      .from('nursery_photos')
      .select('*')
      .eq('id', photoId)
      .eq('nursery_urn', urn)
      .maybeSingle()
    if (fErr) throw fErr
    if (!photo) return res.status(404).json({ error: 'Photo not found' })

    // Delete from storage
    const { error: storageErr } = await db.storage
      .from(STORAGE_BUCKET)
      .remove([photo.storage_path])
    if (storageErr) {
      logger.warn({ err: storageErr.message, storagePath: photo.storage_path }, 'Storage delete failed (proceeding with DB delete)')
    }

    // Delete from DB
    const { error: delErr } = await db
      .from('nursery_photos')
      .delete()
      .eq('id', photoId)
    if (delErr) throw delErr

    logger.info({ userId: req.user.id, urn, photoId }, 'Photo deleted')
    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/v1/provider/nurseries/:urn/photos/reorder — reorder photos (paid only)
router.patch('/nurseries/:urn/photos/reorder', requirePaidProvider, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urn } = req.params
    const { order } = req.body

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'order must be a non-empty array of photo IDs' })
    }
    if (order.length > MAX_PHOTOS) {
      return res.status(400).json({ error: `Too many IDs (max ${MAX_PHOTOS})` })
    }

    // Update display_order for each photo
    const updates = order.map((id, idx) =>
      db
        .from('nursery_photos')
        .update({ display_order: idx })
        .eq('id', id)
        .eq('nursery_urn', urn)
    )
    await Promise.all(updates)

    // Return updated list
    const { data, error } = await db
      .from('nursery_photos')
      .select('*')
      .eq('nursery_urn', urn)
      .order('display_order', { ascending: true })
    if (error) throw error

    logger.info({ userId: req.user.id, urn, count: order.length }, 'Photos reordered')
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// ─── Availability / Waitlist Endpoints ───────────────────────────────────────

const VALID_AGE_GROUPS = ['Under 2', '2-3 years', '3-4 years', '4+ years']

// GET /api/v1/provider/nurseries/:urn/availability — public, no auth
router.get('/nurseries/:urn/availability', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { urn } = req.params
    const { data, error } = await db
      .from('nursery_availability')
      .select('*')
      .eq('nursery_urn', urn)
      .order('age_group', { ascending: true })
    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// PUT /api/v1/provider/nurseries/:urn/availability — provider-only, upserts availability rows
router.put('/nurseries/:urn/availability', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urn } = req.params
    const rows = req.body

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Body must be a non-empty array of availability rows' })
    }
    if (rows.length > VALID_AGE_GROUPS.length) {
      return res.status(400).json({ error: `Maximum ${VALID_AGE_GROUPS.length} age groups` })
    }

    // Validate each row
    for (const row of rows) {
      if (!row.age_group || !VALID_AGE_GROUPS.includes(row.age_group)) {
        return res.status(400).json({ error: `Invalid age_group: ${row.age_group}. Must be one of: ${VALID_AGE_GROUPS.join(', ')}` })
      }
      if (row.spots_available == null || typeof row.spots_available !== 'number' || row.spots_available < 0) {
        return res.status(400).json({ error: 'spots_available must be a non-negative number' })
      }
      if (row.waitlist_length != null && (typeof row.waitlist_length !== 'number' || row.waitlist_length < 0)) {
        return res.status(400).json({ error: 'waitlist_length must be a non-negative number' })
      }
    }

    // Verify ownership
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

    // Upsert each row
    const now = new Date().toISOString()
    const upsertRows = rows.map((row) => ({
      nursery_urn: urn,
      age_group: row.age_group,
      spots_available: row.spots_available,
      waitlist_length: row.waitlist_length ?? 0,
      next_available_date: row.next_available_date || null,
      updated_at: now,
    }))

    const { data, error } = await db
      .from('nursery_availability')
      .upsert(upsertRows, { onConflict: 'nursery_urn,age_group' })
      .select()
    if (error) throw error

    // Update denormalised fields on nurseries table
    const totalSpots = rows.reduce((sum, r) => sum + (r.spots_available || 0), 0)
    const hasWaitlist = rows.some((r) => (r.waitlist_length || 0) > 0)
    const { error: updateErr } = await db
      .from('nurseries')
      .update({
        spots_available: totalSpots,
        has_waitlist: hasWaitlist,
      })
      .eq('urn', urn)
    if (updateErr) {
      logger.warn({ err: updateErr.message, urn }, 'Failed to update denormalised availability fields')
    }

    logger.info(
      { userId: req.user.id, urn, rowCount: rows.length, totalSpots, hasWaitlist },
      'provider updated nursery availability'
    )
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// ─── Fee Management Endpoints ────────────────────────────────────────────────

// GET /api/v1/provider/nurseries/:urn/fees — public, no auth
router.get('/nurseries/:urn/fees', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { urn } = req.params
    const { data, error } = await db
      .from('nursery_fees')
      .select('*')
      .eq('nursery_urn', urn)
      .order('age_group', { ascending: true })
    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/provider/nurseries/:urn/fees — add a fee row (paid only)
router.post('/nurseries/:urn/fees', requirePaidProvider, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urn } = req.params
    const { age_group, session_type, price_gbp, notes } = req.body

    if (!age_group || typeof age_group !== 'string') {
      return res.status(400).json({ error: 'age_group is required' })
    }
    if (!session_type || typeof session_type !== 'string') {
      return res.status(400).json({ error: 'session_type is required' })
    }
    if (price_gbp == null || typeof price_gbp !== 'number' || price_gbp < 0) {
      return res.status(400).json({ error: 'price_gbp must be a non-negative number' })
    }

    const { data, error } = await db
      .from('nursery_fees')
      .insert({
        nursery_urn: urn,
        age_group,
        session_type,
        price_gbp,
        notes: notes || null,
      })
      .select()
      .single()
    if (error) throw error

    logger.info({ userId: req.user.id, urn, feeId: data.id }, 'Fee row added')
    return res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/v1/provider/nurseries/:urn/fees/:feeId — update a fee row (paid only)
router.patch('/nurseries/:urn/fees/:feeId', requirePaidProvider, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urn, feeId } = req.params
    const { age_group, session_type, price_gbp, notes } = req.body

    const update = {}
    if (age_group !== undefined) {
      if (typeof age_group !== 'string') return res.status(400).json({ error: 'age_group must be a string' })
      update.age_group = age_group
    }
    if (session_type !== undefined) {
      if (typeof session_type !== 'string') return res.status(400).json({ error: 'session_type must be a string' })
      update.session_type = session_type
    }
    if (price_gbp !== undefined) {
      if (typeof price_gbp !== 'number' || price_gbp < 0) return res.status(400).json({ error: 'price_gbp must be a non-negative number' })
      update.price_gbp = price_gbp
    }
    if (notes !== undefined) update.notes = notes
    update.updated_at = new Date().toISOString()

    if (Object.keys(update).length <= 1) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    const { data, error } = await db
      .from('nursery_fees')
      .update(update)
      .eq('id', feeId)
      .eq('nursery_urn', urn)
      .select()
      .single()
    if (error) throw error

    logger.info({ userId: req.user.id, urn, feeId }, 'Fee row updated')
    return res.json(data)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/provider/nurseries/:urn/fees/:feeId — delete a fee row (paid only)
router.delete('/nurseries/:urn/fees/:feeId', requirePaidProvider, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urn, feeId } = req.params

    const { error } = await db
      .from('nursery_fees')
      .delete()
      .eq('id', feeId)
      .eq('nursery_urn', urn)
    if (error) throw error

    logger.info({ userId: req.user.id, urn, feeId }, 'Fee row deleted')
    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
