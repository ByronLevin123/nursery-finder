import express from 'express'
import db from '../db.js'
import { geocodePostcode } from '../services/geocoding.js'
import { refreshDistrictPropertyData } from '../services/propertyData.js'
import { requireRole } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()

// GET /api/v1/areas/family-search — MUST be defined before /:district
router.get('/family-search', async (req, res, next) => {
  try {
    const {
      postcode,
      radius_km = 15,
      min_family_score,
      min_nursery_pct,
      sort = 'family_score',
    } = req.query

    if (!postcode) return res.status(400).json({ error: 'postcode required' })

    const { lat, lng } = await geocodePostcode(postcode)

    let query = db
      .from('postcode_areas')
      .select(
        `
        postcode_district, local_authority, region,
        family_score, family_score_breakdown,
        nursery_count_total, nursery_count_outstanding,
        nursery_outstanding_pct, crime_rate_per_1000,
        imd_decile, flood_risk_level, lat, lng
      `
      )
      .not('lat', 'is', null)

    if (min_family_score) query = query.gte('family_score', Number(min_family_score))
    if (min_nursery_pct) query = query.gte('nursery_outstanding_pct', Number(min_nursery_pct))

    const { data: areas, error } = await query
    if (error) throw error

    const filtered = areas
      .map((area) => ({ ...area, distance_km: haversineKm(lat, lng, area.lat, area.lng) }))
      .filter((area) => area.distance_km <= Number(radius_km))
      .sort((a, b) => {
        if (sort === 'family_score') return (b.family_score || 0) - (a.family_score || 0)
        if (sort === 'nursery_score')
          return (b.nursery_outstanding_pct || 0) - (a.nursery_outstanding_pct || 0)
        return a.distance_km - b.distance_km
      })

    res.json({ data: filtered, meta: { total: filtered.length, search_lat: lat, search_lng: lng } })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/areas/:district — area summary (stats + property + score)
router.get('/:district', async (req, res, next) => {
  try {
    const district = req.params.district.toUpperCase()

    const { data: area, error } = await db
      .from('postcode_areas')
      .select(
        `
        postcode_district, local_authority, region,
        nursery_count_total, nursery_count_outstanding, nursery_count_good,
        nursery_outstanding_pct,
        avg_sale_price_all, avg_sale_price_flat, avg_sale_price_terraced,
        avg_sale_price_semi, avg_sale_price_detached,
        crime_rate_per_1000, imd_decile, flood_risk_level, flood_updated_at,
        nearest_park_name, nearest_park_distance_m, park_count_within_1km, parks_updated_at,
        asking_price_avg, rent_avg_weekly, gross_yield_pct,
        demand_rating, days_on_market, price_growth_1yr_pct,
        propertydata_sample_postcode, propertydata_updated_at,
        family_score, family_score_breakdown, lat, lng, updated_at
      `
      )
      .eq('postcode_district', district)
      .maybeSingle()

    if (error) throw error
    if (!area) return res.status(404).json({ error: 'District not found' })
    res.json(area)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/areas/:district/nurseries
router.get('/:district/nurseries', async (req, res, next) => {
  try {
    const district = req.params.district.toUpperCase()

    const { data: nurseries, error } = await db
      .from('nurseries')
      .select(
        'urn, name, provider_type, address_line1, town, postcode, local_authority, ofsted_overall_grade, last_inspection_date, inspection_report_url, inspection_date_warning, enforcement_notice, total_places, places_funded_2yr, places_funded_3_4yr, fee_avg_monthly, fee_report_count, lat, lng'
      )
      .eq('registration_status', 'Active')
      .like('postcode', `${district}%`)
      .order('ofsted_overall_grade', { ascending: true, nullsFirst: false })
      .limit(200)

    if (error) throw error

    const total = nurseries.length
    const outstanding = nurseries.filter((n) => n.ofsted_overall_grade === 'Outstanding').length
    const good = nurseries.filter((n) => n.ofsted_overall_grade === 'Good').length

    res.json({ nurseries, stats: { total, outstanding, good, district } })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/areas/:district/refresh-property-data — admin-only manual refresh
router.post('/:district/refresh-property-data', requireRole('admin'), async (req, res, next) => {
  try {
    const district = req.params.district.toUpperCase()
    logger.info({ district }, 'areas: manual propertydata refresh')
    const result = await refreshDistrictPropertyData(district, { force: true })
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'areas: manual propertydata refresh failed')
    next(err)
  }
})

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default router
