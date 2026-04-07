import express from 'express'
import db from '../db.js'
import { geocodePostcode } from '../services/geocoding.js'
import { searchCache, searchCacheKey } from '../services/cache.js'
import { smartSearch } from '../services/smartSearch.js'
import { logger } from '../logger.js'

const router = express.Router()

// POST /api/v1/nurseries/search
router.post('/search', async (req, res, next) => {
  try {
    const {
      postcode,
      radius_km = 5,
      grade = null,
      funded_2yr = false,
      funded_3yr = false,
      page = 1,
      limit = 20,
    } = req.body

    if (!postcode) {
      return res.status(400).json({ error: 'postcode is required' })
    }

    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i
    if (!postcodeRegex.test(postcode.trim())) {
      return res.status(400).json({ error: 'Invalid UK postcode format' })
    }

    const cacheKey = searchCacheKey({ postcode, radiusKm: radius_km, grade, funded2yr: funded_2yr, funded3yr: funded_3yr })
    const cached = searchCache.get(cacheKey)
    if (cached) {
      return res.json({ ...cached, cached: true })
    }

    const { lat, lng } = await geocodePostcode(postcode)

    const { data, error } = await db.rpc('search_nurseries_near', {
      search_lat: lat,
      search_lng: lng,
      radius_km: Number(radius_km),
      grade_filter: grade || null,
      funded_2yr: Boolean(funded_2yr),
      funded_3yr: Boolean(funded_3yr),
    })

    if (error) throw error

    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(50, Math.max(1, Number(limit)))
    const start = (pageNum - 1) * limitNum
    const paginated = data.slice(start, start + limitNum)

    const result = {
      data: paginated,
      meta: {
        total: data.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(data.length / limitNum),
        search_lat: lat,
        search_lng: lng,
      }
    }

    searchCache.set(cacheKey, result)
    logger.info({ postcode, radius_km, results: data.length }, 'search completed')
    res.json(result)

  } catch (err) {
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: 'Postcode not found' })
    }
    next(err)
  }
})

// POST /api/v1/nurseries/smart-search — auto postcode vs text
router.post('/smart-search', async (req, res, next) => {
  try {
    const { query, radius_km = 5, grade = null, funded_2yr = false, funded_3yr = false } = req.body
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'query is required' })
    }

    const cacheKey = searchCacheKey({ postcode: `smart:${query}`, radiusKm: radius_km, grade, funded2yr: funded_2yr, funded3yr: funded_3yr })
    const cached = searchCache.get(cacheKey)
    if (cached) return res.json({ ...cached, cached: true })

    const result = await smartSearch({ query, radius_km, grade, funded_2yr, funded_3yr })
    searchCache.set(cacheKey, result)
    logger.info({ query, mode: result.meta.mode, results: result.meta.total }, 'smart-search completed')
    res.json(result)
  } catch (err) {
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: 'Postcode not found' })
    }
    next(err)
  }
})

// POST /api/v1/nurseries/compare — must be before /:urn route
router.post('/compare', async (req, res, next) => {
  try {
    const { urns } = req.body
    if (!Array.isArray(urns) || urns.length < 2 || urns.length > 5) {
      return res.status(400).json({ error: 'Provide 2-5 URNs to compare' })
    }

    const { data, error } = await db
      .from('nurseries')
      .select('*')
      .in('urn', urns)

    if (error) throw error
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/nurseries/fees — submit anonymous fee
router.post('/fees', async (req, res, next) => {
  try {
    const { nursery_id, fee_per_month, hours_per_week, age_group } = req.body

    if (!nursery_id || !fee_per_month) {
      return res.status(400).json({ error: 'nursery_id and fee_per_month required' })
    }
    if (fee_per_month < 100 || fee_per_month > 5000) {
      return res.status(400).json({ error: 'fee_per_month must be between 100 and 5000' })
    }

    const { error } = await db.from('nursery_fees').insert({
      nursery_id, fee_per_month, hours_per_week, age_group
    })

    if (error) throw error

    const { data: fees } = await db
      .from('nursery_fees')
      .select('fee_per_month')
      .eq('nursery_id', nursery_id)

    if (fees?.length >= 3) {
      const avg = Math.round(fees.reduce((s, f) => s + f.fee_per_month, 0) / fees.length)
      await db.from('nurseries').update({
        fee_avg_monthly: avg,
        fee_report_count: fees.length
      }).eq('id', nursery_id)
    }

    res.json({ success: true, message: 'Fee submitted anonymously. Thank you!' })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/nurseries/:urn
router.get('/:urn', async (req, res, next) => {
  try {
    const { data, error } = await db
      .from('nurseries')
      .select('*')
      .eq('urn', req.params.urn)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Nursery not found' })
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

export default router
