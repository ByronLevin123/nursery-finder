// Provider data routes — pricing, availability, and staff metrics.
// Write routes require auth + nursery ownership. Read routes are public.

import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()

const VALID_AGE_GROUPS = ['0-1', '1-2', '2-3', '3-4', '4-5']
const VALID_SESSION_TYPES = ['full_day', 'half_day_am', 'half_day_pm', 'flexible']

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

// POST /api/v1/provider/nurseries/:urn/pricing — upsert pricing rows
router.post('/nurseries/:urn/pricing', requireAuth, async (req, res, next) => {
  try {
    const check = await verifyOwnership(req.params.urn, req.user.id)
    if (check.error) return res.status(check.status).json({ error: check.error })

    const rows = Array.isArray(req.body) ? req.body : [req.body]
    if (rows.length === 0) return res.status(400).json({ error: 'No pricing data provided' })
    if (rows.length > 20) return res.status(400).json({ error: 'Maximum 20 pricing rows per request' })

    for (const row of rows) {
      if (!VALID_AGE_GROUPS.includes(row.age_group)) {
        return res.status(400).json({ error: `Invalid age_group: ${row.age_group}` })
      }
      if (!VALID_SESSION_TYPES.includes(row.session_type)) {
        return res.status(400).json({ error: `Invalid session_type: ${row.session_type}` })
      }
    }

    const inserts = rows.map((r) => ({
      nursery_id: check.nursery.id,
      age_group: r.age_group,
      session_type: r.session_type,
      fee_per_month: r.fee_per_month || null,
      hours_per_week: r.hours_per_week || null,
      funded_hours_deducted: r.funded_hours_deducted || false,
      effective_monthly_cost: r.effective_monthly_cost || null,
      meals_included: r.meals_included || false,
      source: 'provider',
    }))

    // Delete existing provider pricing for this nursery and re-insert
    await db
      .from('nursery_pricing')
      .delete()
      .eq('nursery_id', check.nursery.id)
      .eq('source', 'provider')

    const { data, error } = await db
      .from('nursery_pricing')
      .insert(inserts)
      .select()

    if (error) throw error
    logger.info({ urn: req.params.urn, rows: inserts.length }, 'provider pricing updated')
    return res.json({ data })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/provider/nurseries/:urn/pricing — public read
router.get('/nurseries/:urn/pricing', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data: nursery } = await db
      .from('nurseries')
      .select('id')
      .eq('urn', req.params.urn)
      .maybeSingle()
    if (!nursery) return res.status(404).json({ error: 'Nursery not found' })

    const { data, error } = await db
      .from('nursery_pricing')
      .select('*')
      .eq('nursery_id', nursery.id)
      .order('age_group', { ascending: true })

    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/provider/nurseries/:urn/availability — upsert availability
router.post('/nurseries/:urn/availability', requireAuth, async (req, res, next) => {
  try {
    const check = await verifyOwnership(req.params.urn, req.user.id)
    if (check.error) return res.status(check.status).json({ error: check.error })

    const rows = Array.isArray(req.body) ? req.body : [req.body]
    if (rows.length === 0) return res.status(400).json({ error: 'No availability data provided' })

    for (const row of rows) {
      if (!VALID_AGE_GROUPS.includes(row.age_group)) {
        return res.status(400).json({ error: `Invalid age_group: ${row.age_group}` })
      }
    }

    const inserts = rows.map((r) => ({
      nursery_id: check.nursery.id,
      age_group: r.age_group,
      total_capacity: r.total_capacity || null,
      current_enrolled: r.current_enrolled || 0,
      waitlist_count: r.waitlist_count || 0,
      next_available: r.next_available || null,
      next_intake: r.next_intake || null,
      updated_by: req.user.id,
      updated_at: new Date().toISOString(),
    }))

    // Delete existing and re-insert
    await db
      .from('nursery_availability')
      .delete()
      .eq('nursery_id', check.nursery.id)

    const { data, error } = await db
      .from('nursery_availability')
      .insert(inserts)
      .select()

    if (error) throw error
    logger.info({ urn: req.params.urn, rows: inserts.length }, 'provider availability updated')
    return res.json({ data })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/provider/nurseries/:urn/availability — public read
router.get('/nurseries/:urn/availability', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data: nursery } = await db
      .from('nurseries')
      .select('id')
      .eq('urn', req.params.urn)
      .maybeSingle()
    if (!nursery) return res.status(404).json({ error: 'Nursery not found' })

    const { data, error } = await db
      .from('nursery_availability')
      .select('*')
      .eq('nursery_id', nursery.id)
      .order('age_group', { ascending: true })

    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/provider/nurseries/:urn/staff — upsert staff metrics
router.post('/nurseries/:urn/staff', requireAuth, async (req, res, next) => {
  try {
    const check = await verifyOwnership(req.params.urn, req.user.id)
    if (check.error) return res.status(check.status).json({ error: check.error })

    const { total_staff, qualified_teachers, level_3_plus, avg_tenure_months, ratio_under_2, ratio_2_to_3, ratio_3_plus } = req.body

    const row = {
      nursery_id: check.nursery.id,
      total_staff: total_staff || null,
      qualified_teachers: qualified_teachers || null,
      level_3_plus: level_3_plus || null,
      avg_tenure_months: avg_tenure_months || null,
      ratio_under_2: ratio_under_2 || null,
      ratio_2_to_3: ratio_2_to_3 || null,
      ratio_3_plus: ratio_3_plus || null,
      updated_at: new Date().toISOString(),
    }

    // Upsert — one row per nursery
    const { data: existing } = await db
      .from('nursery_staff')
      .select('id')
      .eq('nursery_id', check.nursery.id)
      .maybeSingle()

    let data, error
    if (existing) {
      ;({ data, error } = await db
        .from('nursery_staff')
        .update(row)
        .eq('nursery_id', check.nursery.id)
        .select()
        .single())
    } else {
      ;({ data, error } = await db
        .from('nursery_staff')
        .insert(row)
        .select()
        .single())
    }

    if (error) throw error
    logger.info({ urn: req.params.urn }, 'provider staff metrics updated')
    return res.json(data)
  } catch (err) {
    next(err)
  }
})

export default router
