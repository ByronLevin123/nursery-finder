// Notification routes — in-app notifications for logged-in users.

import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()

// GET /api/v1/notifications — recent notifications (newest first, limit 50)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const limit = Math.min(parseInt(req.query.limit) || 50, 100)

    const { data, error } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/notifications/unread-count
router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { count, error } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .is('read_at', null)

    if (error) throw error
    return res.json({ count: count || 0 })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/v1/notifications/:id/read — mark single notification as read
router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data, error } = await db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Notification not found' })

    return res.json(data)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/v1/notifications/read-all — mark all as read
router.patch('/read-all', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { error } = await db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', req.user.id)
      .is('read_at', null)

    if (error) throw error

    logger.info({ userId: req.user.id }, 'all notifications marked as read')
    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
