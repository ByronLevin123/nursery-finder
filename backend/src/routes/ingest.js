import express from 'express'
import { ingestOfstedRegister } from '../services/ofstedIngest.js'
import { ingestSchoolsFromCsv, geocodeSchoolsBatch as geocodeSchoolsBatchLegacy } from '../services/schoolIngest.js'
import { ingestSchoolsFromCsvUrl, geocodeSchoolsBatch } from '../services/schoolsIngest.js'
import { ingestCareInspectorateData } from '../services/careInspectorateIngest.js'
import { ingestCiwData } from '../services/ciwIngest.js'
import { geocodeNurseriesBatch } from '../services/geocoding.js'
import { ingestLandRegistryYear, refreshPropertyStats } from '../services/landRegistry.js'
import { refreshCrimeForDistricts } from '../services/policeApi.js'
import { refreshImdForDistricts } from '../services/imdApi.js'
import { refreshAllDistricts as refreshPropertyDataDistricts } from '../services/propertyData.js'
import { syncGooglePlacesData, refreshStaleGoogleData } from '../services/googlePlaces.js'
import { startJob, updateJobProgress, completeJob, failJob } from '../services/jobTracker.js'
import { captureReportSnapshot } from '../services/reportSnapshot.js'
import basicAuth from 'express-basic-auth'
import { requireRole } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'
import db from '../db.js'

const router = express.Router()

// Ingest routes accept EITHER HTTP basic auth (for Render cron jobs)
// OR Supabase JWT with admin role (for admin panel).
const cronBasicAuth = basicAuth({
  users: { [process.env.ADMIN_USER || '']: process.env.ADMIN_PASS || '' },
  challenge: false,
})

router.use((req, res, next) => {
  const authHeader = req.headers.authorization || ''
  if (authHeader.startsWith('Basic ')) {
    return cronBasicAuth(req, res, next)
  }
  return requireRole('admin')(req, res, next)
})

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
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 500))
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
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 500))
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

// POST /api/v1/ingest/care-inspectorate — import Scottish childcare data
router.post('/care-inspectorate', async (req, res, next) => {
  try {
    const csvUrl = req.body?.csv_url || req.query.csv_url
    if (!csvUrl) {
      return res.status(400).json({
        error: 'csv_url is required. Download from https://www.careinspectorate.com/index.php/statistics-and-analysis/data-and-analysis',
      })
    }
    logger.info({ csvUrl }, 'ingest: starting Care Inspectorate import')
    const result = await ingestCareInspectorateData(csvUrl)
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: Care Inspectorate import failed')
    next(err)
  }
})

// POST /api/v1/ingest/ciw — import Welsh childcare data
router.post('/ciw', async (req, res, next) => {
  try {
    const csvUrl = req.body?.csv_url || req.query.csv_url
    if (!csvUrl) {
      return res.status(400).json({
        error: 'csv_url is required. Download from https://careinspectorate.wales/service-directory',
      })
    }
    logger.info({ csvUrl }, 'ingest: starting CIW import')
    const result = await ingestCiwData(csvUrl)
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: CIW import failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /api/v1/ingest/full-cycle — run all ingest steps in dependency order
// ---------------------------------------------------------------------------
const FULL_CYCLE_STEPS = {
  ofsted:       { fn: () => ingestOfstedRegister(), deps: [] },
  schools:      { fn: () => ingestSchoolsFromCsvUrl(), deps: [] },
  crime:        { fn: () => refreshCrimeForDistricts({ limit: 50, staleDays: 30 }), deps: [] },
  imd:          { fn: () => refreshImdForDistricts({ limit: 200, staleDays: 365 }), deps: [] },
  google:       { fn: () => syncGooglePlacesData(100, { staleDays: 90, photosEnabled: true }), deps: [] },
  geocode:      { fn: () => geocodeNurseriesBatch(2000), deps: ['ofsted'] },
  'schools-geo': { fn: () => geocodeSchoolsBatch(500), deps: ['schools'] },
  aggregate:    { fn: () => db.rpc('refresh_postcode_area_nursery_stats').then(r => { if (r.error) throw r.error; return { districts_updated: r.data } }), deps: ['geocode', 'schools-geo'] },
  family:       { fn: () => db.rpc('calculate_all_family_scores').then(r => { if (r.error) throw r.error; return { districts_updated: r.data } }), deps: ['aggregate', 'crime', 'imd'] },
  snapshot:     { fn: () => captureReportSnapshot(), deps: ['family'] },
}

async function runFullCycle(jobId) {
  const stepStatus = {}
  for (const id of Object.keys(FULL_CYCLE_STEPS)) {
    stepStatus[id] = { status: 'pending' }
  }

  function hasFailed(stepId) {
    return stepStatus[stepId]?.status === 'failed' || stepStatus[stepId]?.status === 'skipped'
  }

  // Build layers from the DAG via topological sort
  const layers = []
  const placed = new Set()
  while (placed.size < Object.keys(FULL_CYCLE_STEPS).length) {
    const layer = []
    for (const [id, step] of Object.entries(FULL_CYCLE_STEPS)) {
      if (placed.has(id)) continue
      if (step.deps.every((d) => placed.has(d))) layer.push(id)
    }
    if (layer.length === 0) break
    layers.push(layer)
    for (const id of layer) placed.add(id)
  }

  for (const layer of layers) {
    await updateJobProgress(jobId, { steps: { ...stepStatus }, current_layer: layers.indexOf(layer) })

    const results = await Promise.allSettled(
      layer.map(async (stepId) => {
        const step = FULL_CYCLE_STEPS[stepId]
        // Skip if any dependency failed
        if (step.deps.some(hasFailed)) {
          stepStatus[stepId] = { status: 'skipped', reason: 'dependency failed' }
          return
        }
        stepStatus[stepId] = { status: 'running' }
        await updateJobProgress(jobId, { steps: { ...stepStatus }, current_step: stepId })
        try {
          const result = await step.fn()
          stepStatus[stepId] = { status: 'completed', result }
        } catch (err) {
          logger.error({ step: stepId, err: err?.message }, 'full-cycle: step failed')
          stepStatus[stepId] = { status: 'failed', error: err?.message }
        }
      })
    )
  }

  const allFailed = Object.values(stepStatus).every((s) => s.status === 'failed' || s.status === 'skipped')
  const finalResult = { steps: stepStatus }

  if (allFailed) {
    await failJob(jobId, 'All steps failed')
  } else {
    await completeJob(jobId, finalResult)
  }

  logger.info({ jobId, steps: Object.fromEntries(Object.entries(stepStatus).map(([k, v]) => [k, v.status])) }, 'full-cycle: complete')
}

router.post('/full-cycle', async (req, res, next) => {
  try {
    // Concurrency guard — prevent double-runs
    if (db) {
      const { data: running } = await db
        .from('job_runs')
        .select('id, started_at')
        .eq('job_type', 'full_cycle')
        .eq('status', 'running')
        .gte('started_at', new Date(Date.now() - 3600000).toISOString())
        .limit(1)
      if (running?.length > 0) {
        return res.status(409).json({
          error: 'A full cycle is already running',
          jobId: running[0].id,
        })
      }
    }

    const jobId = await startJob('full_cycle', req.user?.id)
    res.json({ status: 'started', jobId, message: 'Full data refresh started in background.' })

    runFullCycle(jobId).catch((err) => {
      logger.error({ err: err?.message, jobId }, 'full-cycle: unexpected error')
      failJob(jobId, err?.message)
    })
  } catch (err) {
    next(err)
  }
})

export default router
