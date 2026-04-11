import express from 'express'
import { ingestOfstedRegister } from '../services/ofstedIngest.js'
import { ingestSchoolsFromCsv, geocodeSchoolsBatch } from '../services/schoolIngest.js'
import { geocodeNurseriesBatch } from '../services/geocoding.js'
import { ingestLandRegistryYear, refreshPropertyStats } from '../services/landRegistry.js'
import { refreshCrimeForDistricts } from '../services/policeApi.js'
import { refreshImdForDistricts } from '../services/imdApi.js'
import { refreshAllDistricts as refreshPropertyDataDistricts } from '../services/propertyData.js'
import { syncGooglePlacesData, refreshStaleGoogleData } from '../services/googlePlaces.js'
import { requireRole } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'
import db from '../db.js'

const router = express.Router()

// All ingest routes require admin auth
router.use(requireRole('admin'))

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

// POST /api/v1/ingest/crime?limit=50
router.post('/crime', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const staleDays = parseInt(req.query.stale_days) || 30
    logger.info({ limit, staleDays }, 'ingest: starting crime refresh')
    const result = await refreshCrimeForDistricts({ limit, staleDays })
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: crime refresh failed')
    next(err)
  }
})

// POST /api/v1/ingest/imd?limit=200
router.post('/imd', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 200
    const staleDays = parseInt(req.query.stale_days) || 365
    logger.info({ limit, staleDays }, 'ingest: starting imd refresh')
    const result = await refreshImdForDistricts({ limit, staleDays })
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: imd refresh failed')
    next(err)
  }
})

// POST /api/v1/ingest/family-scores — batch recompute across every district
router.post('/family-scores', async (req, res, next) => {
  try {
    const { data, error } = await db.rpc('calculate_all_family_scores')
    if (error) throw error
    logger.info({ districts: data }, 'ingest: family-scores recomputed')
    res.json({ districts_updated: data })
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: family-scores failed')
    next(err)
  }
})

// POST /api/v1/ingest/propertydata — refresh live market data from PropertyData.co.uk
router.post('/propertydata', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const force = req.query.force === '1' || req.query.force === 'true'
    const staleDays = parseInt(req.query.stale_days) || 30
    logger.info({ limit, force, staleDays }, 'ingest: starting propertydata refresh')
    const result = await refreshPropertyDataDistricts({ limit, force, staleDays })
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: propertydata refresh failed')
    next(err)
  }
})

// POST /api/v1/ingest/dimension-scores
router.post('/dimension-scores', async (req, res, next) => {
  try {
    const { recomputeAllDimensionScores } = await import('../services/scoringEngine.js')
    logger.info('ingest: starting dimension score recompute')
    const result = await recomputeAllDimensionScores()
    logger.info(result, 'ingest: dimension scores complete')
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: dimension scores failed')
    next(err)
  }
})

// POST /api/v1/ingest/schools — import schools from a CSV URL
router.post('/schools', async (req, res, next) => {
  try {
    const csvUrl = req.body?.csv_url || req.query.csv_url
    if (!csvUrl) {
      return res.status(400).json({ error: 'csv_url is required (body or query param)' })
    }
    logger.info({ csvUrl }, 'ingest: starting school import')
    const result = await ingestSchoolsFromCsv(csvUrl)
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: school import failed')
    next(err)
  }
})

// POST /api/v1/ingest/schools-geocode — geocode schools with missing lat/lng
router.post('/schools-geocode', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 500
    logger.info({ limit }, 'ingest: starting school geocoding batch')
    const result = await geocodeSchoolsBatch(limit)
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: school geocoding failed')
    next(err)
  }
})

// POST /api/v1/ingest/google-places?limit=100&photos=1
router.post('/google-places', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    const photosEnabled = req.query.photos !== '0'
    const staleDays = parseInt(req.query.stale_days) || 90
    logger.info({ limit, photosEnabled, staleDays }, 'ingest: starting Google Places sync')
    const result = await syncGooglePlacesData(limit, { staleDays, photosEnabled })
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: Google Places sync failed')
    next(err)
  }
})

// POST /api/v1/ingest/google-places-refresh?limit=100
router.post('/google-places-refresh', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    const staleDays = parseInt(req.query.stale_days) || 90
    logger.info({ limit, staleDays }, 'ingest: starting Google Places stale refresh')
    const result = await refreshStaleGoogleData(limit, staleDays)
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: Google Places refresh failed')
    next(err)
  }
})

export default router
