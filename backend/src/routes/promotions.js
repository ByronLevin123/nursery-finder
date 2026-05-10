// Promotions — admin CRUD + public nearby matching + impression/click tracking

import express from 'express'
import db from '../db.js'
import { logger } from '../logger.js'
import { requireRole } from '../middleware/supabaseAuth.js'

const router = express.Router()

// ============================================================
// Public routes (mounted at /api/v1/promotions)
// ============================================================

// GET /nearby — public, fetch active promotions near a location
router.get('/nearby', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { lat, lng, category, radius } = req.query
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' })
    }

    const searchLat = parseFloat(lat)
    const searchLng = parseFloat(lng)
    const radiusKm = parseFloat(radius) || 10

    if (isNaN(searchLat) || isNaN(searchLng)) {
      return res.status(400).json({ error: 'Invalid lat/lng values' })
    }

    // Use the PostGIS RPC function
    const { data, error } = await db.rpc('search_promotions_near', {
      search_lat: searchLat,
      search_lng: searchLng,
      radius_km: radiusKm,
      cat_filter: category || null,
    })

    if (error) {
      logger.error({ error: error.message }, 'promotions: nearby search failed')
      throw error
    }

    res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// POST /:id/impression — track impression
router.post('/:id/impression', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { id } = req.params
    await db
      .rpc('increment_promotion_counter', { promo_id: id, counter_name: 'impression_count' })
      .catch(() => {
        // Fallback: direct update if RPC doesn't exist
        return db
          .from('promotions')
          .update({ impression_count: db.raw('impression_count + 1') })
          .eq('id', id)
      })

    // Simple increment — fire and forget approach with fallback
    const { error } = await db
      .from('promotions')
      .select('impression_count')
      .eq('id', id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return { error: null }
        return db
          .from('promotions')
          .update({ impression_count: (data.impression_count || 0) + 1 })
          .eq('id', id)
      })

    if (error) logger.warn({ error: error.message, id }, 'promotions: impression tracking failed')

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// POST /:id/click — track click
router.post('/:id/click', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { id } = req.params

    const { data } = await db.from('promotions').select('click_count').eq('id', id).maybeSingle()

    if (data) {
      const { error } = await db
        .from('promotions')
        .update({ click_count: (data.click_count || 0) + 1 })
        .eq('id', id)

      if (error) logger.warn({ error: error.message, id }, 'promotions: click tracking failed')
    }

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// Admin routes (mounted at /api/v1/admin/promotions)
// ============================================================

export const adminPromotionsRouter = express.Router()

// GET / — list all promotions
adminPromotionsRouter.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { active, category, page = 1, limit = 50 } = req.query
    let query = db
      .from('promotions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (active !== undefined) {
      query = query.eq('active', active === 'true')
    }
    if (category) {
      query = query.eq('category', category)
    }

    const offset = (parseInt(page) - 1) * parseInt(limit)
    query = query.range(offset, offset + parseInt(limit) - 1)

    const { data, error, count } = await query

    if (error) throw error

    res.json({ data: data || [], total: count || 0, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    logger.error({ err: err.message }, 'promotions: admin list failed')
    next(err)
  }
})

// POST / — create promotion
adminPromotionsRouter.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const {
      title,
      description,
      image_url,
      link_url,
      category,
      lat,
      lng,
      postcode_district,
      radius_km,
      start_date,
      end_date,
      active,
    } = req.body

    if (!title || !link_url || !category) {
      return res.status(400).json({ error: 'title, link_url and category are required' })
    }

    const validCategories = [
      'swimming',
      'music',
      'tutoring',
      'baby_gear',
      'dance',
      'sports',
      'arts',
      'language',
      'childcare',
      'health',
      'other',
    ]
    if (!validCategories.includes(category)) {
      return res
        .status(400)
        .json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` })
    }

    const { data, error } = await db
      .from('promotions')
      .insert({
        title,
        description: description || null,
        image_url: image_url || null,
        link_url,
        category,
        lat: lat != null ? parseFloat(lat) : null,
        lng: lng != null ? parseFloat(lng) : null,
        postcode_district: postcode_district || null,
        radius_km: radius_km != null ? parseFloat(radius_km) : 10,
        start_date: start_date || null,
        end_date: end_date || null,
        active: active !== false,
        created_by: req.user.id,
      })
      .select('*')
      .single()

    if (error) throw error

    logger.info({ id: data.id, title }, 'promotions: created')
    res.status(201).json({ data })
  } catch (err) {
    logger.error({ err: err.message }, 'promotions: create failed')
    next(err)
  }
})

// PATCH /:id — update promotion
adminPromotionsRouter.patch('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { id } = req.params
    const updates = { ...req.body, updated_at: new Date().toISOString() }

    // Remove fields that shouldn't be updated directly
    delete updates.id
    delete updates.created_at
    delete updates.created_by
    delete updates.location // Computed by trigger

    if (updates.lat != null) updates.lat = parseFloat(updates.lat)
    if (updates.lng != null) updates.lng = parseFloat(updates.lng)
    if (updates.radius_km != null) updates.radius_km = parseFloat(updates.radius_km)

    const { data, error } = await db
      .from('promotions')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Promotion not found' })

    logger.info({ id }, 'promotions: updated')
    res.json({ data })
  } catch (err) {
    logger.error({ err: err.message }, 'promotions: update failed')
    next(err)
  }
})

// DELETE /:id — soft-delete (set active = false)
adminPromotionsRouter.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { id } = req.params
    const { data, error } = await db
      .from('promotions')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Promotion not found' })

    logger.info({ id }, 'promotions: deactivated')
    res.json({ success: true })
  } catch (err) {
    logger.error({ err: err.message }, 'promotions: delete failed')
    next(err)
  }
})

export default router
