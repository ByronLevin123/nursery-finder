// Provider analytics routes + public view counter.

import express from 'express'
import rateLimit from 'express-rate-limit'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()

// In-memory view debounce: IP → { urn → timestamp }
const viewDebounce = new Map()
const VIEW_DEBOUNCE_MS = 5 * 60 * 1000 // 5 minutes

// Rate-limit view counter to avoid abuse
const viewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})

// POST /api/v1/nurseries/:urn/view — increment view count (public, debounced)
router.post('/nurseries/:urn/view', viewLimiter, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urn } = req.params
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown'
    const key = `${ip}:${urn}`
    const now = Date.now()

    // Debounce: max 1 view per IP per nursery per 5 minutes
    const last = viewDebounce.get(key)
    if (last && now - last < VIEW_DEBOUNCE_MS) {
      return res.json({ counted: false })
    }
    viewDebounce.set(key, now)

    // Periodically clean the map (every ~100 calls)
    if (viewDebounce.size > 10000) {
      for (const [k, t] of viewDebounce) {
        if (now - t > VIEW_DEBOUNCE_MS) viewDebounce.delete(k)
      }
    }

    const { error } = await db.rpc('increment_view_count', { nursery_urn: urn })
    if (error) {
      // Fallback: direct update if RPC not available
      await db
        .from('nurseries')
        .update({ view_count: db.raw ? db.raw('view_count + 1') : 1 })
        .eq('urn', urn)
    }

    return res.json({ counted: true })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/provider/analytics — aggregate stats for claimed nurseries
router.get('/analytics', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    // Get nurseries owned by this user
    const { data: nurseries, error: nErr } = await db
      .from('nurseries')
      .select('id, urn, name, view_count, compare_count')
      .eq('claimed_by_user_id', req.user.id)
    if (nErr) throw nErr
    if (!nurseries || nurseries.length === 0) {
      return res.json({ data: [] })
    }

    const nurseryIds = nurseries.map((n) => n.id)

    // Enquiry stats
    const { data: enquiries } = await db
      .from('enquiries')
      .select('nursery_id, status, sent_at')
      .in('nursery_id', nurseryIds)

    // Visit booking stats
    const { data: bookings } = await db
      .from('visit_bookings')
      .select('nursery_id, status, created_at')
      .in('nursery_id', nurseryIds)

    // Survey averages
    const { data: surveys } = await db
      .from('visit_surveys')
      .select('nursery_id, overall_impression, staff_friendliness, facilities_quality')
      .in('nursery_id', nurseryIds)

    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const stats = nurseries.map((n) => {
      const nEnq = (enquiries || []).filter((e) => e.nursery_id === n.id)
      const nBookings = (bookings || []).filter((b) => b.nursery_id === n.id)
      const nSurveys = (surveys || []).filter((s) => s.nursery_id === n.id)

      const enquiryTotal = nEnq.length
      const enquiryThisMonth = nEnq.filter((e) => e.sent_at && e.sent_at.startsWith(thisMonth)).length
      const responded = nEnq.filter((e) => e.status !== 'sent' && e.status !== 'opened').length

      const bookingTotal = nBookings.length
      const upcoming = nBookings.filter((b) => b.status === 'confirmed').length
      const completed = nBookings.filter((b) => b.status === 'completed').length

      const avgOverall =
        nSurveys.length > 0
          ? nSurveys.reduce((s, r) => s + (r.overall_impression || 0), 0) / nSurveys.length
          : null
      const avgStaff =
        nSurveys.length > 0
          ? nSurveys.reduce((s, r) => s + (r.staff_friendliness || 0), 0) / nSurveys.length
          : null
      const avgFacilities =
        nSurveys.length > 0
          ? nSurveys.reduce((s, r) => s + (r.facilities_quality || 0), 0) / nSurveys.length
          : null

      return {
        urn: n.urn,
        name: n.name,
        view_count: n.view_count || 0,
        compare_count: n.compare_count || 0,
        enquiries: {
          total: enquiryTotal,
          this_month: enquiryThisMonth,
          conversion: enquiryTotal > 0 ? Math.round((responded / enquiryTotal) * 100) : 0,
        },
        visits: {
          total: bookingTotal,
          upcoming,
          completed,
        },
        survey_avg: {
          overall: avgOverall ? Math.round(avgOverall * 10) / 10 : null,
          staff: avgStaff ? Math.round(avgStaff * 10) / 10 : null,
          facilities: avgFacilities ? Math.round(avgFacilities * 10) / 10 : null,
          count: nSurveys.length,
        },
      }
    })

    return res.json({ data: stats })
  } catch (err) {
    next(err)
  }
})

export default router
