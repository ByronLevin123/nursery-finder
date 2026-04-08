// Travel-time + isochrone routes.
// All routes are wrapped in try/catch and log via pino.

import express from 'express'
import rateLimit from 'express-rate-limit'
import db from '../db.js'
import { geocodePostcode } from '../services/geocoding.js'
import { getTravelTime, getTravelMatrix } from '../services/travelTime.js'
import { logger } from '../logger.js'

const router = express.Router()

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many travel requests, please slow down' },
})
router.use(limiter)

const VALID_MODES = new Set(['walk', 'cycle', 'drive'])

// Resolve an endpoint: accepts {lat,lng} | {postcode} | {urn}
async function resolveEndpoint(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('endpoint must be an object')
  }
  if (Number.isFinite(input.lat) && Number.isFinite(input.lng)) {
    return { lat: Number(input.lat), lng: Number(input.lng) }
  }
  if (input.postcode && typeof input.postcode === 'string') {
    const { lat, lng } = await geocodePostcode(input.postcode)
    return { lat, lng }
  }
  if (input.urn) {
    if (!db) throw new Error('database unavailable')
    const { data, error } = await db
      .from('nurseries')
      .select('lat, lng')
      .eq('urn', String(input.urn))
      .maybeSingle()
    if (error) throw error
    if (!data?.lat || !data?.lng) throw new Error('nursery has no location')
    return { lat: data.lat, lng: data.lng }
  }
  throw new Error('endpoint requires lat/lng, postcode, or urn')
}

// POST /api/v1/travel/time
router.post('/time', async (req, res, next) => {
  try {
    const { from, to, mode = 'walk' } = req.body || {}
    if (!VALID_MODES.has(mode)) {
      return res.status(400).json({ error: 'mode must be walk|cycle|drive' })
    }
    const f = await resolveEndpoint(from)
    const t = await resolveEndpoint(to)
    const result = await getTravelTime({
      fromLat: f.lat,
      fromLng: f.lng,
      toLat: t.lat,
      toLng: t.lng,
      mode,
    })
    logger.info({ mode, cached: result.cached }, 'travel/time')
    res.json(result)
  } catch (err) {
    logger.warn({ err: err.message }, 'travel/time failed')
    next(err)
  }
})

// POST /api/v1/travel/isochrone
// body: { from, durations_min: [10,20,30], mode }
// Returns a GeoJSON FeatureCollection with one polygon per duration band.
// Implementation: 20x20 grid, Table API, octagon hull per band.
router.post('/isochrone', async (req, res, next) => {
  try {
    const { from, durations_min, mode = 'drive' } = req.body || {}
    if (!VALID_MODES.has(mode)) {
      return res.status(400).json({ error: 'mode must be walk|cycle|drive' })
    }
    const durations = Array.isArray(durations_min) && durations_min.length
      ? durations_min.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [15, 30, 45, 60]
    if (!durations.length) {
      return res.status(400).json({ error: 'durations_min required' })
    }
    const f = await resolveEndpoint(from)

    // Bounding box ~15km radius (roughly 0.14° lat, 0.22° lng at UK latitudes).
    const radiusKm = mode === 'walk' ? 5 : mode === 'cycle' ? 15 : 30
    const dLat = radiusKm / 111
    const dLng = radiusKm / (111 * Math.cos((f.lat * Math.PI) / 180))
    const GRID = 20
    const points = []
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const lat = f.lat - dLat + (2 * dLat * i) / (GRID - 1)
        const lng = f.lng - dLng + (2 * dLng * j) / (GRID - 1)
        points.push({ lat, lng })
      }
    }

    const matrix = await getTravelMatrix({ from: f, to: points, mode })

    const features = []
    const sortedDurations = [...durations].sort((a, b) => a - b)
    for (const durMin of sortedDurations) {
      const reachable = []
      for (let i = 0; i < points.length; i++) {
        const s = matrix[i]?.duration_s
        if (s != null && s <= durMin * 60) {
          reachable.push(points[i])
        }
      }
      if (reachable.length < 3) continue
      // Octagon hull: for each of 8 compass directions, pick the point maximizing
      // cos(theta) * (lng-f.lng) + sin(theta) * (lat-f.lat).
      const dirs = []
      for (let k = 0; k < 8; k++) {
        const theta = (k / 8) * 2 * Math.PI
        dirs.push({ cos: Math.cos(theta), sin: Math.sin(theta) })
      }
      const hull = dirs.map((d) => {
        let best = reachable[0]
        let bestScore = -Infinity
        for (const p of reachable) {
          const score = d.cos * (p.lng - f.lng) + d.sin * (p.lat - f.lat)
          if (score > bestScore) {
            bestScore = score
            best = p
          }
        }
        return [best.lng, best.lat]
      })
      hull.push(hull[0])
      features.push({
        type: 'Feature',
        properties: { duration_min: durMin, mode },
        geometry: { type: 'Polygon', coordinates: [hull] },
      })
    }

    logger.info({ mode, bands: features.length }, 'travel/isochrone')
    res.json({
      type: 'FeatureCollection',
      features,
      meta: { from: f, mode, durations_min: sortedDurations },
    })
  } catch (err) {
    logger.warn({ err: err.message }, 'travel/isochrone failed')
    next(err)
  }
})

export default router
