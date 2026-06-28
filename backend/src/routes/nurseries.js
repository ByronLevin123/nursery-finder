import express from 'express'
import db from '../db.js'
import { geocodePostcode } from '../services/geocoding.js'
import { searchCache, searchCacheKey } from '../services/cache.js'
import { autocompleteCache, similarCache } from '../services/cache.js'
import { smartSearch } from '../services/smartSearch.js'
import { logger } from '../logger.js'
import { trackActivity } from '../services/activityTracker.js'

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

    const cacheKey = searchCacheKey({
      postcode,
      radiusKm: radius_km,
      grade,
      funded2yr: funded_2yr,
      funded3yr: funded_3yr,
    })
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
      },
    }

    searchCache.set(cacheKey, result)
    logger.info({ postcode, radius_km, results: data.length }, 'search completed')
    trackActivity(req.user?.id, 'search', {
      metadata: { postcode, radius_km, result_count: data.length, grade, funded_2yr, funded_3yr },
      req,
    })
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
    const {
      query,
      lat,
      lng,
      radius_km = 5,
      grade = null,
      has_availability = false,
      min_rating = null,
      provider_type = null,
      has_funded_2yr = false,
      has_funded_3yr = false,
      curriculum = null,
      sen = false,
      dietary = null,
      language = null,
    } = req.body
    if ((!query || !query.trim()) && lat == null && lng == null) {
      return res.status(400).json({ error: 'query or lat/lng is required' })
    }

    const cacheKey = searchCacheKey({
      postcode: lat != null ? `coord:${lat},${lng}` : `smart:${query}`,
      radiusKm: radius_km,
      grade,
      funded2yr: has_funded_2yr,
      funded3yr: has_funded_3yr,
      hasAvailability: has_availability,
      minRating: min_rating,
      providerType: provider_type,
      hasFunded2yr: has_funded_2yr,
      hasFunded3yr: has_funded_3yr,
      curriculum,
      sen,
      dietary,
      language,
    })
    const cached = searchCache.get(cacheKey)
    if (cached) return res.json({ ...cached, cached: true })

    const result = await smartSearch({
      query: query || '',
      lat,
      lng,
      radius_km,
      grade,
      has_availability,
      min_rating,
      provider_type,
      has_funded_2yr,
      has_funded_3yr,
      curriculum,
      sen,
      dietary,
      language,
    })
    searchCache.set(cacheKey, result)
    logger.info(
      { query, mode: result.meta.mode, results: result.meta.total },
      'smart-search completed'
    )
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
    if (!Array.isArray(urns) || urns.length < 1 || urns.length > 10) {
      return res.status(400).json({ error: 'Provide 1-10 URNs' })
    }

    const { data, error } = await db.from('nurseries').select('*').in('urn', urns)

    if (error) throw error

    for (const u of urns) {
      Promise.resolve(db.rpc('increment_compare_count', { nursery_urn: u })).catch(() => {})
    }
    trackActivity(req.user?.id, 'compare', { metadata: { urns }, req })

    res.json({ data })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/nurseries/fees — submit anonymous fee
router.post('/fees', async (req, res, next) => {
  try {
    const { nursery_urn, fee_per_month, hours_per_week, age_group } = req.body

    if (!nursery_urn || !fee_per_month) {
      return res.status(400).json({ error: 'nursery_urn and fee_per_month required' })
    }
    if (fee_per_month < 100 || fee_per_month > 5000) {
      return res.status(400).json({ error: 'fee_per_month must be between 100 and 5000' })
    }

    const row = {
      nursery_urn,
      price_gbp: fee_per_month,
      age_group: age_group || 'all',
      session_type: 'Monthly',
    }
    if (hours_per_week) row.hours_per_week = hours_per_week
    if (fee_per_month) row.fee_per_month = fee_per_month

    const { error } = await db.from('nursery_fees').insert(row)
    if (error) throw error

    // Update nursery average from all fee submissions
    const { data: fees } = await db
      .from('nursery_fees')
      .select('price_gbp')
      .eq('nursery_urn', nursery_urn)

    if (fees?.length >= 3) {
      const avg = Math.round(fees.reduce((s, f) => s + (f.price_gbp || 0), 0) / fees.length)
      await db
        .from('nurseries')
        .update({ fee_avg_monthly: avg, fee_report_count: fees.length })
        .eq('urn', nursery_urn)
    }

    res.json({ success: true, message: 'Fee submitted anonymously. Thank you!' })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/nurseries/autocomplete?q=... — must be before /:urn routes
router.get('/autocomplete', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim()
    if (q.length < 2) return res.json({ suggestions: [] })

    // Check cache first (60s TTL)
    const cacheKey = `ac:${q.toLowerCase()}`
    const cached = autocompleteCache.get(cacheKey)
    if (cached) return res.json({ suggestions: cached })

    const { data, error } = await db.rpc('autocomplete_suggestions', {
      query_text: q,
      max_results: 8,
    })

    if (error) {
      logger.warn({ error, q }, 'autocomplete RPC failed, falling back to ilike')
      // Fallback to simple ilike if RPC not available yet
      const suggestions = []
      const { data: nurseries } = await db
        .from('nurseries')
        .select('urn, name, postcode, town')
        .ilike('name', `%${q}%`)
        .not('location', 'is', null)
        .limit(6)
      if (nurseries) {
        for (const n of nurseries) {
          suggestions.push({
            type: 'nursery',
            label: `${n.name}${n.town ? `, ${n.town}` : ''}`,
            urn: n.urn,
          })
        }
      }
      return res.json({ suggestions: suggestions.slice(0, 8) })
    }

    const suggestions = (data || []).map((r) => ({
      type: r.type,
      label: r.label,
      urn: r.urn || undefined,
      postcode: r.postcode || undefined,
    }))

    autocompleteCache.set(cacheKey, suggestions)
    res.json({ suggestions })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/nurseries/towns — distinct towns with nursery count
router.get('/towns', async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200))
    const { data, error } = await db
      .from('nurseries')
      .select('town')
      .not('town', 'is', null)
      .not('location', 'is', null)

    if (error) throw error

    // Aggregate counts in JS — normalize casing (title case) to merge duplicates
    const counts = {}
    const canonical = {}
    for (const row of data || []) {
      const t = row.town.trim()
      if (!t) continue
      const key = t.toLowerCase()
      counts[key] = (counts[key] || 0) + 1
      // Keep the most common casing (title case preferred)
      if (!canonical[key] || (t[0] === t[0].toUpperCase() && t !== t.toUpperCase())) {
        canonical[key] = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
      }
    }

    const towns = Object.entries(counts)
      .map(([key, count]) => ({ name: canonical[key] || key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    logger.info({ towns: towns.length }, 'towns list returned')
    res.json({ data: towns })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/nurseries/by-town/:town — nurseries in a town, sorted by grade
router.get('/by-town/:town', async (req, res, next) => {
  try {
    const town = decodeURIComponent(req.params.town).trim()
    if (!town) {
      return res.status(400).json({ error: 'town parameter is required' })
    }

    const { data, error } = await db
      .from('nurseries')
      .select('*')
      .ilike('town', town)
      .not('location', 'is', null)
      .limit(50)

    if (error) throw error
    if (!data || data.length === 0) {
      return res.status(404).json({ error: `No nurseries found in ${town}` })
    }

    // Sort by grade then name
    const gradeOrder = { Outstanding: 1, Good: 2, 'Requires Improvement': 3, Inadequate: 4 }
    const sorted = data.sort((a, b) => {
      const ga = gradeOrder[a.ofsted_overall_grade] || 5
      const gb = gradeOrder[b.ofsted_overall_grade] || 5
      if (ga !== gb) return ga - gb
      return (a.name || '').localeCompare(b.name || '')
    })

    // Compute stats
    const stats = {
      total: sorted.length,
      outstanding: sorted.filter((n) => n.ofsted_overall_grade === 'Outstanding').length,
      good: sorted.filter((n) => n.ofsted_overall_grade === 'Good').length,
    }

    logger.info({ town, results: sorted.length }, 'by-town lookup')
    res.json({ data: sorted, stats, town: data[0]?.town || town })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/nurseries/:urn/similar
router.get('/:urn/similar', async (req, res, next) => {
  try {
    const urn = req.params.urn

    // Check cache first (1 hour TTL)
    const cacheKey = `similar:${urn}`
    const cached = similarCache.get(cacheKey)
    if (cached) {
      return res.json({ data: cached, cached: true })
    }

    // First fetch the target nursery to get its location and grade
    const { data: nursery, error: nurseryErr } = await db
      .from('nurseries')
      .select('urn, lat, lng, ofsted_overall_grade, location')
      .eq('urn', urn)
      .single()

    if (nurseryErr || !nursery) {
      return res.status(404).json({ error: 'Nursery not found' })
    }

    if (!nursery.lat || !nursery.lng) {
      return res.json({ data: [] })
    }

    const targetGrade = nursery.ofsted_overall_grade

    // Search within 3km radius
    const radiusKm = 3
    const { data, error } = await db.rpc('search_nurseries_near', {
      search_lat: nursery.lat,
      search_lng: nursery.lng,
      radius_km: radiusKm,
      grade_filter: null,
      funded_2yr: false,
      funded_3yr: false,
    })

    if (error) throw error

    // Exclude self, sort by same grade first then distance, limit to 6
    const similar = (data || [])
      .filter((n) => n.urn !== nursery.urn)
      .sort((a, b) => {
        const aMatch = a.ofsted_overall_grade === targetGrade ? 0 : 1
        const bMatch = b.ofsted_overall_grade === targetGrade ? 0 : 1
        if (aMatch !== bMatch) return aMatch - bMatch
        return (a.distance_km || 999) - (b.distance_km || 999)
      })
      .slice(0, 6)

    similarCache.set(cacheKey, similar)
    logger.info({ urn, results: similar.length }, 'similar nurseries lookup')
    res.json({ data: similar })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/nurseries/:urn/availability — public availability data
router.get('/:urn/availability', async (req, res, next) => {
  try {
    const { urn } = req.params
    const { data, error } = await db
      .from('nursery_availability')
      .select('*')
      .eq('nursery_urn', urn)
      .order('age_group', { ascending: true })
    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/nurseries/:urn/progression — school progression path
router.get('/:urn/progression', async (req, res, next) => {
  try {
    const { urn } = req.params

    const { data: nursery, error: nErr } = await db
      .from('nurseries')
      .select('urn, name, ofsted_overall_grade, postcode, town, lat, lng')
      .eq('urn', urn)
      .maybeSingle()
    if (nErr) throw nErr
    if (!nursery) return res.status(404).json({ error: 'Nursery not found' })
    if (!nursery.lat || !nursery.lng) {
      return res.json({ nursery, schools: [], timeline: null })
    }

    const { data: schools, error: sErr } = await db.rpc('search_schools_near', {
      search_lat: nursery.lat,
      search_lng: nursery.lng,
      radius_km: 2,
      phase_filter: 'Primary',
    })
    if (sErr) throw sErr

    const { data: secondarySchools, error: secErr } = await db.rpc('search_schools_near', {
      search_lat: nursery.lat,
      search_lng: nursery.lng,
      radius_km: 3,
      phase_filter: 'Secondary',
    })
    if (secErr) throw secErr

    const now = new Date()
    const receptionYear = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear()

    const timeline = [
      { stage: 'Nursery', ages: '0-4', current: true, location: nursery.name },
      {
        stage: 'Reception',
        ages: '4-5',
        year: receptionYear,
        location: schools?.[0]?.name || 'Nearby primary school',
      },
      {
        stage: 'Primary',
        ages: '5-11',
        location: schools?.[0]?.name || 'Nearby primary school',
      },
      {
        stage: 'Secondary',
        ages: '11-16',
        location: secondarySchools?.[0]?.name || 'Nearby secondary school',
      },
      {
        stage: 'Sixth Form',
        ages: '16-18',
        location: secondarySchools?.[0]?.name || 'Nearby sixth form',
      },
    ]

    const primaryList = (schools || []).slice(0, 5).map((s) => ({
      urn: s.urn,
      name: s.name,
      ofsted_rating: s.ofsted_rating,
      age_range: s.age_range,
      distance_km: s.distance_km,
      pupils: s.pupils,
      website: s.website,
    }))

    const secondaryList = (secondarySchools || []).slice(0, 5).map((s) => ({
      urn: s.urn,
      name: s.name,
      ofsted_rating: s.ofsted_rating,
      age_range: s.age_range,
      distance_km: s.distance_km,
      pupils: s.pupils,
      website: s.website,
    }))

    res.json({
      nursery: { urn: nursery.urn, name: nursery.name, grade: nursery.ofsted_overall_grade },
      schools: primaryList,
      primary_schools: primaryList,
      secondary_schools: secondaryList,
      timeline,
    })
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
