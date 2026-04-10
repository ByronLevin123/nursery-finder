import express from 'express'
import db from '../db.js'
import { logger } from '../logger.js'

const router = express.Router()

// GET /api/v1/schools/near?lat=&lng=&radius_km=3&phase=Primary
router.get('/near', async (req, res, next) => {
  try {
    const { lat, lng, radius_km = 3, phase = null } = req.query

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' })
    }

    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ error: 'lat and lng must be valid numbers' })
    }

    if (latNum < 49 || latNum > 61 || lngNum < -8 || lngNum > 2) {
      return res.status(400).json({ error: 'Coordinates must be within the UK' })
    }

    const radiusKm = Math.min(10, Math.max(0.1, parseFloat(radius_km) || 3))
    const phaseFilter = phase && ['Primary', 'Secondary', 'All-through'].includes(phase)
      ? phase
      : null

    const { data, error } = await db.rpc('search_schools_near', {
      search_lat: latNum,
      search_lng: lngNum,
      radius_km: radiusKm,
      phase_filter: phaseFilter,
    })

    if (error) throw error

    logger.info(
      { lat: latNum, lng: lngNum, radius_km: radiusKm, phase: phaseFilter, results: (data || []).length },
      'schools near lookup'
    )

    res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/schools/:urn
router.get('/:urn', async (req, res, next) => {
  try {
    const { data, error } = await db
      .from('schools')
      .select('*')
      .eq('urn', req.params.urn)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'School not found' })
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

export default router
