import express from 'express'
import db from '../db.js'
import { geocodePostcode } from '../services/geocoding.js'
import { logger } from '../logger.js'

const router = express.Router()

// GET /api/v1/areas/:district/nurseries
router.get('/:district/nurseries', async (req, res, next) => {
  try {
    const district = req.params.district.toUpperCase()

    const { data: nurseries, error } = await db
      .from('nurseries')
      .select('urn, name, provider_type, address_line1, town, postcode, local_authority, ofsted_overall_grade, last_inspection_date, inspection_report_url, inspection_date_warning, enforcement_notice, total_places, places_funded_2yr, places_funded_3_4yr, fee_avg_monthly, fee_report_count, lat, lng')
      .eq('registration_status', 'Active')
      .like('postcode', `${district}%`)
      .order('ofsted_overall_grade', { ascending: true, nullsFirst: false })
      .limit(200)

    if (error) throw error

    const total = nurseries.length
    const outstanding = nurseries.filter(n => n.ofsted_overall_grade === 'Outstanding').length
    const good = nurseries.filter(n => n.ofsted_overall_grade === 'Good').length

    res.json({ nurseries, stats: { total, outstanding, good, district } })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/areas/family-search
router.get('/family-search', async (req, res, next) => {
  try {
    const {
      postcode,
      radius_km = 15,
      min_family_score,
      max_median_price,
      min_nursery_pct,
      sort = 'family_score',
    } = req.query

    if (!postcode) return res.status(400).json({ error: 'postcode required' })

    const { lat, lng } = await geocodePostcode(postcode)

    let query = db
      .from('postcode_areas')
      .select(`
        postcode_district, local_authority, region,
        family_score, family_score_breakdown,
        nursery_count_total, nursery_count_outstanding,
        nursery_outstanding_pct, crime_rate_per_1000,
        imd_decile, flood_risk_level, lat, lng
      `)
      .not('lat', 'is', null)

    if (min_family_score) query = query.gte('family_score', Number(min_family_score))
    if (min_nursery_pct) query = query.gte('nursery_outstanding_pct', Number(min_nursery_pct))

    const { data: areas, error } = await query

    if (error) throw error

    const filtered = areas
      .map(area => {
        const dist = haversineKm(lat, lng, area.lat, area.lng)
        return { ...area, distance_km: dist }
      })
      .filter(area => area.distance_km <= Number(radius_km))
      .sort((a, b) => {
        if (sort === 'family_score') return (b.family_score || 0) - (a.family_score || 0)
        if (sort === 'nursery_score') return (b.nursery_outstanding_pct || 0) - (a.nursery_outstanding_pct || 0)
        return a.distance_km - b.distance_km
      })

    res.json({ data: filtered, meta: { total: filtered.length, search_lat: lat, search_lng: lng } })
  } catch (err) {
    next(err)
  }
})

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export default router
