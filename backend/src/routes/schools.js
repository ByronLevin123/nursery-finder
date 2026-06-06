import express from 'express'
import db from '../db.js'
import { geocodePostcode } from '../services/geocoding.js'
import { searchCache } from '../services/cache.js'
import { logger } from '../logger.js'

const router = express.Router()

// POST /api/v1/schools/search — search by postcode
router.post('/search', async (req, res, next) => {
  try {
    const { postcode, radius_km = 3, phase = null, ofsted_rating = null } = req.body

    if (!postcode) {
      return res.status(400).json({ error: 'postcode is required' })
    }

    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i
    if (!postcodeRegex.test(postcode.trim())) {
      return res.status(400).json({ error: 'Invalid UK postcode format' })
    }

    const cacheKey = `schools:${postcode.trim().toUpperCase()}:${radius_km}:${phase || ''}:${ofsted_rating || ''}`
    const cached = searchCache.get(cacheKey)
    if (cached) {
      return res.json({ ...cached, cached: true })
    }

    const { lat, lng } = await geocodePostcode(postcode)

    const radiusKm = Math.min(10, Math.max(0.1, parseFloat(radius_km) || 3))
    const phaseFilter =
      phase && ['Primary', 'Secondary', 'All-through'].includes(phase) ? phase : null

    const { data, error } = await db.rpc('search_schools_near', {
      search_lat: lat,
      search_lng: lng,
      radius_km: radiusKm,
      phase_filter: phaseFilter,
    })

    if (error) throw error

    let filtered = data || []
    if (ofsted_rating) {
      filtered = filtered.filter((s) => s.ofsted_rating === ofsted_rating)
    }

    const result = {
      data: filtered,
      meta: {
        total: filtered.length,
        search_lat: lat,
        search_lng: lng,
      },
    }

    searchCache.set(cacheKey, result)

    logger.info(
      {
        postcode,
        radius_km: radiusKm,
        phase: phaseFilter,
        ofsted_rating,
        results: filtered.length,
      },
      'school search completed'
    )

    res.json(result)
  } catch (err) {
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: 'Postcode not found' })
    }
    next(err)
  }
})

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
    const phaseFilter =
      phase && ['Primary', 'Secondary', 'All-through'].includes(phase) ? phase : null

    const { data, error } = await db.rpc('search_schools_near', {
      search_lat: latNum,
      search_lng: lngNum,
      radius_km: radiusKm,
      phase_filter: phaseFilter,
    })

    if (error) throw error

    logger.info(
      {
        lat: latNum,
        lng: lngNum,
        radius_km: radiusKm,
        phase: phaseFilter,
        results: (data || []).length,
      },
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
    const { data, error } = await db.from('schools').select('*').eq('urn', req.params.urn).single()

    if (error || !data) {
      return res.status(404).json({ error: 'School not found' })
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

export default router
