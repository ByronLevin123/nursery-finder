import express from 'express'
import { ingestOfstedRegister } from '../services/ofstedIngest.js'
import { geocodeNurseriesBatch } from '../services/geocoding.js'
import { ingestLandRegistryYear, refreshPropertyStats } from '../services/landRegistry.js'
import { ingestCrimeDataBatch } from '../services/policeApi.js'
import { adminAuth } from '../middleware/auth.js'
import { logger } from '../logger.js'
import db from '../db.js'

const router = express.Router()

// All ingest routes require admin auth
router.use(adminAuth)

// POST /api/v1/ingest/ofsted
router.post('/ofsted', async (req, res, next) => {
  try {
    logger.info('ingest: starting Ofsted register import')
    const result = await ingestOfstedRegister()
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: Ofsted import failed')
    next(err)
  }
})

// POST /api/v1/ingest/geocode
router.post('/geocode', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 500
    logger.info({ limit }, 'ingest: starting geocoding batch')
    const result = await geocodeNurseriesBatch(limit)
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: geocoding failed')
    next(err)
  }
})

// POST /api/v1/ingest/aggregate-areas — refresh nursery counts per postcode district
router.post('/aggregate-areas', async (req, res, next) => {
  try {
    const { data, error } = await db.rpc('refresh_postcode_area_nursery_stats')
    if (error) throw error
    logger.info({ districts: data }, 'ingest: aggregate-areas complete')
    res.json({ districts_updated: data })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/ingest/property-stats — recompute avg_sale_price_* per district
router.post('/property-stats', async (req, res, next) => {
  try {
    const { data, error } = await db.rpc('compute_area_property_stats')
    if (error) throw error
    logger.info({ districts: data }, 'ingest: property-stats refreshed')
    res.json({ districts_updated: data })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/ingest/land-registry
router.post('/land-registry', async (req, res, next) => {
  try {
    const currentYear = new Date().getFullYear()
    const results = []
    // Try current year (may 404 if early in year), then last 2
    for (const year of [currentYear, currentYear - 1, currentYear - 2]) {
      try {
        const result = await ingestLandRegistryYear(year)
        results.push(result)
      } catch (err) {
        logger.warn({ year, err: err.message }, 'land_registry: year skipped')
        results.push({ year, skipped: true, error: err.message })
      }
    }
    await refreshPropertyStats()
    res.json({ years: results })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/ingest/crime
router.post('/crime', async (req, res, next) => {
  try {
    const { data: districts } = await db
      .from('postcode_areas')
      .select('postcode_district')
      .or(
        'crime_last_updated.is.null,crime_last_updated.lt.' +
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      )
      .not('lat', 'is', null)
      .limit(100)

    const result = await ingestCrimeDataBatch(districts.map((d) => d.postcode_district))
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/ingest/family-scores
router.post('/family-scores', async (req, res, next) => {
  try {
    const { data: districts } = await db
      .from('postcode_areas')
      .select('postcode_district')
      .not('nursery_count_total', 'is', null)

    let calculated = 0
    for (const { postcode_district } of districts) {
      await db.rpc('calculate_family_score', { district: postcode_district })
      calculated++
    }

    res.json({ calculated })
  } catch (err) {
    next(err)
  }
})

export default router
