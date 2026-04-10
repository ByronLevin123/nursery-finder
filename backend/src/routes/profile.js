// Profile API — current user's profile row in user_profiles
// All routes require a valid Supabase JWT.

import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'
import { startSequence } from '../services/dripEngine.js'

const router = express.Router()

const ALLOWED_FIELDS = [
  'display_name',
  'avatar_url',
  'home_postcode',
  'work_postcode',
  'children',
  'preferences',
  'email_alerts',
  'email_weekly_digest',
  'email_new_nurseries',
  'email_marketing',
]

function validatePatch(patch) {
  if (!patch || typeof patch !== 'object') return 'invalid body'
  if (patch.display_name != null) {
    if (typeof patch.display_name !== 'string' || patch.display_name.length > 80) {
      return 'display_name must be a string up to 80 chars'
    }
  }
  if (patch.avatar_url != null) {
    if (typeof patch.avatar_url !== 'string' || patch.avatar_url.length > 500) {
      return 'avatar_url must be a string up to 500 chars'
    }
  }
  if (patch.home_postcode != null) {
    if (typeof patch.home_postcode !== 'string' || patch.home_postcode.length > 16) {
      return 'home_postcode must be a string up to 16 chars'
    }
  }
  if (patch.work_postcode != null) {
    if (typeof patch.work_postcode !== 'string' || patch.work_postcode.length > 16) {
      return 'work_postcode must be a string up to 16 chars'
    }
  }
  if (patch.children != null) {
    if (!Array.isArray(patch.children) || patch.children.length > 20) {
      return 'children must be an array of up to 20 entries'
    }
  }
  if (patch.preferences != null && typeof patch.preferences !== 'object') {
    return 'preferences must be an object'
  }
  if (patch.email_alerts != null && typeof patch.email_alerts !== 'boolean') {
    return 'email_alerts must be a boolean'
  }
  if (patch.email_weekly_digest != null && typeof patch.email_weekly_digest !== 'boolean') {
    return 'email_weekly_digest must be a boolean'
  }
  if (patch.email_new_nurseries != null && typeof patch.email_new_nurseries !== 'boolean') {
    return 'email_new_nurseries must be a boolean'
  }
  if (patch.email_marketing != null && typeof patch.email_marketing !== 'boolean') {
    return 'email_marketing must be a boolean'
  }
  return null
}

// GET /api/v1/profile
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { data, error } = await db
      .from('user_profiles')
      .select('*')
      .eq('id', req.user.id)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      // Lazily create — trigger may not have fired (or running with service key against test)
      const { data: created, error: insErr } = await db
        .from('user_profiles')
        .insert({ id: req.user.id })
        .select()
        .single()
      if (insErr) {
        return res.status(404).json({ error: 'Profile not found' })
      }
      // New profile — start welcome drip sequence
      try {
        await startSequence(req.user.id, 'welcome')
      } catch (seqErr) {
        logger.warn({ err: seqErr?.message }, 'welcome drip start failed')
      }
      return res.json(created)
    }
    return res.json(data)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/v1/profile
router.patch('/', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const validationError = validatePatch(req.body)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    const update = {}
    for (const f of ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, f)) {
        update[f] = req.body[f]
      }
    }
    update.updated_at = new Date().toISOString()

    const { data, error } = await db
      .from('user_profiles')
      .update(update)
      .eq('id', req.user.id)
      .select()
      .single()
    if (error) throw error

    logger.info({ userId: req.user.id, fields: Object.keys(update) }, 'profile updated')
    return res.json(data)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/profile/export — GDPR data export (returns all user data as JSON)
router.get('/export', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user.id

    // Gather all user data in parallel
    const [profileRes, claimsRes, reviewsRes, searchesRes, enquiriesRes, visitsRes, messagesRes, notificationsRes] =
      await Promise.all([
        db.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
        db.from('nursery_claims').select('*').eq('user_id', userId),
        db.from('nursery_reviews').select('*').eq('user_id', userId),
        db.from('saved_searches').select('*').eq('user_id', userId),
        db.from('enquiries').select('*').eq('user_id', userId),
        db.from('visit_bookings').select('*').eq('user_id', userId),
        db.from('messages').select('*').eq('sender_id', userId),
        db.from('notifications').select('*').eq('user_id', userId),
      ])

    const exportData = {
      exported_at: new Date().toISOString(),
      profile: profileRes.data || null,
      claims: claimsRes.data || [],
      reviews: reviewsRes.data || [],
      saved_searches: searchesRes.data || [],
      enquiries: enquiriesRes.data || [],
      visit_bookings: visitsRes.data || [],
      messages: messagesRes.data || [],
      notifications: notificationsRes.data || [],
    }

    logger.info({ userId }, 'GDPR data export requested')
    res.setHeader('Content-Disposition', 'attachment; filename="my-data.json"')
    return res.json(exportData)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/profile — GDPR right to erasure (delete account and all user data)
router.delete('/', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const userId = req.user.id

    // Delete user data from all tables (order matters for FK constraints)
    const tables = [
      { table: 'notifications', column: 'user_id' },
      { table: 'messages', column: 'sender_id' },
      { table: 'visit_bookings', column: 'user_id' },
      { table: 'enquiries', column: 'user_id' },
      { table: 'saved_searches', column: 'user_id' },
      { table: 'nursery_reviews', column: 'user_id' },
      { table: 'nursery_claims', column: 'user_id' },
      { table: 'drip_queue', column: 'user_id' },
      { table: 'user_profiles', column: 'id' },
    ]

    for (const { table, column } of tables) {
      const { error } = await db.from(table).delete().eq(column, userId)
      if (error) {
        logger.warn({ table, userId, err: error.message }, 'GDPR delete failed for table')
      }
    }

    // Unclaim any nurseries this user had claimed
    await db
      .from('nurseries')
      .update({ claimed_by_user_id: null, claimed_at: null })
      .eq('claimed_by_user_id', userId)

    logger.info({ userId }, 'GDPR account deletion completed')
    return res.json({ message: 'Account and all associated data deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
