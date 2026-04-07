import express from 'express'
import db from '../db.js'
import { adminAuth } from '../middleware/auth.js'
import { logger } from '../logger.js'
import { refreshAllFloodRisk, refreshFloodRiskForDistrict } from '../services/floodRisk.js'
import { refreshAllParks, refreshParksForDistrict } from '../services/parksData.js'
import { ingestSchoolsFromCsvUrl, geocodeSchoolsBatch } from '../services/schoolsIngest.js'
import { geocodePostcode } from '../services/geocoding.js'

const router = express.Router()

// --- Flood ---
router.post('/flood/refresh-all', adminAuth, async (req, res, next) => {
  try {
    logger.info('overlays: flood refresh-all start')
    const result = await refreshAllFloodRisk(req.body || {})
    logger.info({ result }, 'overlays: flood refresh-all done')
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'overlays: flood refresh-all failed')
    next(err)
  }
})

router.post('/flood/:district/refresh', adminAuth, async (req, res, next) => {
  try {
    const district = req.params.district
    logger.info({ district }, 'overlays: flood district refresh start')
    const result = await refreshFloodRiskForDistrict(district)
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'overlays: flood district refresh failed')
    next(err)
  }
})

// --- Parks ---
router.post('/parks/refresh-all', adminAuth, async (req, res, next) => {
  try {
    logger.info('overlays: parks refresh-all start')
    const result = await refreshAllParks(req.body || {})
    logger.info({ result }, 'overlays: parks refresh-all done')
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'overlays: parks refresh-all failed')
    next(err)
  }
})

router.post('/parks/:district/refresh', adminAuth, async (req, res, next) => {
  try {
    const district = req.params.district
    logger.info({ district }, 'overlays: parks district refresh start')
    const result = await refreshParksForDistrict(district)
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'overlays: parks district refresh failed')
    next(err)
  }
})

// --- Schools ---
router.post('/schools/ingest', adminAuth, async (req, res, next) => {
  try {
    const { csvUrl } = req.body || {}
    logger.info({ csvUrl: csvUrl ? 'provided' : 'default' }, 'overlays: schools ingest start')
    const result = await ingestSchoolsFromCsvUrl(csvUrl)
    logger.info({ result }, 'overlays: schools ingest done')
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'overlays: schools ingest failed')
    next(err)
  }
})

router.post('/schools/geocode', adminAuth, async (req, res, next) => {
  try {
    logger.info('overlays: schools geocode start')
    const limit = Number(req.body?.limit) || 500
    const result = await geocodeSchoolsBatch(limit)
    logger.info({ result }, 'overlays: schools geocode done')
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'overlays: schools geocode failed')
    next(err)
  }
})

router.get('/schools/near', async (req, res, next) => {
  try {
    const { postcode, phase, radius_km = 2, lat: latQ, lng: lngQ } = req.query
    const radius = Math.min(Number(radius_km) || 2, 10)

    let origin
    if (latQ && lngQ) {
      origin = { lat: Number(latQ), lng: Number(lngQ) }
    } else if (postcode) {
      try {
        origin = await geocodePostcode(String(postcode))
      } catch (err) {
        logger.warn({ err: err.message, postcode }, 'overlays: schools/near geocode failed')
        return res.status(400).json({ error: 'invalid postcode' })
      }
    } else {
      return res.status(400).json({ error: 'postcode or lat/lng required' })
    }

    // Bounding box (~1 degree lat = 111km)
    const dLat = radius / 111
    const dLng = radius / (111 * Math.cos((origin.lat * Math.PI) / 180))

    let q = db
      .from('schools')
      .select('urn, name, phase, postcode, lat, lng, ofsted_grade, last_inspection_date')
      .not('lat', 'is', null)
      .gte('lat', origin.lat - dLat)
      .lte('lat', origin.lat + dLat)
      .gte('lng', origin.lng - dLng)
      .lte('lng', origin.lng + dLng)
      .limit(200)

    if (phase) q = q.eq('phase', String(phase))

    const { data, error } = await q
    if (error) throw error

    const toRad = (d) => (d * Math.PI) / 180
    const haversine = (a, b) => {
      const R = 6371
      const dLatR = toRad(b.lat - a.lat)
      const dLngR = toRad(b.lng - a.lng)
      const x =
        Math.sin(dLatR / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLngR / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
    }

    const enriched = (data || [])
      .map((s) => ({
        ...s,
        distance_km: Number(haversine(origin, { lat: s.lat, lng: s.lng }).toFixed(2)),
      }))
      .filter((s) => s.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 50)

    res.json({ data: enriched, meta: { total: enriched.length, postcode, radius_km: radius } })
  } catch (err) {
    logger.error({ err: err.message }, 'overlays: schools/near failed')
    next(err)
  }
})

export default router
