import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()

// POST /api/v1/shortlist/share — create a shared shortlist
router.post('/share', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urns, name } = req.body || {}
    if (!Array.isArray(urns) || urns.length === 0) {
      return res.status(400).json({ error: 'urns must be a non-empty array' })
    }
    if (urns.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 nurseries per shared shortlist' })
    }

    const { data, error } = await db
      .from('shared_shortlists')
      .insert({
        user_id: req.user.id,
        urns,
        name: name || null,
      })
      .select('token')
      .single()

    if (error) throw error

    logger.info({ userId: req.user.id, count: urns.length }, 'shared shortlist created')
    res.status(201).json({ token: data.token })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/shortlist/shared/:token — view a shared shortlist
router.get('/shared/:token', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data: shortlist, error } = await db
      .from('shared_shortlists')
      .select('urns, name, created_at, expires_at')
      .eq('token', req.params.token)
      .maybeSingle()

    if (error) throw error
    if (!shortlist) return res.status(404).json({ error: 'Shortlist not found or expired' })

    if (shortlist.expires_at && new Date(shortlist.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This shared shortlist has expired' })
    }

    // Fetch nursery details
    const { data: nurseries } = await db
      .from('nurseries')
      .select(
        'urn, name, town, postcode, ofsted_overall_grade, total_places, fee_avg_monthly, lat, lng'
      )
      .in('urn', shortlist.urns)

    res.json({
      name: shortlist.name,
      nurseries: nurseries || [],
      created_at: shortlist.created_at,
    })
  } catch (err) {
    next(err)
  }
})

export default router
