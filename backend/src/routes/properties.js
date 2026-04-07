import express from 'express'
import db from '../db.js'
import { refreshDistrictListings } from '../services/propertyDataListings.js'
import { adminAuth } from '../middleware/auth.js'
import { logger } from '../logger.js'

const router = express.Router()

// GET /api/v1/properties/search
router.get('/search', async (req, res, next) => {
  try {
    const {
      district,
      type = 'sale',
      min_price,
      max_price,
      min_beds,
      max_beds,
      property_type,
    } = req.query

    if (!district) return res.status(400).json({ error: 'district required' })
    const listingType = type === 'rent' ? 'rent' : 'sale'
    const districtUpper = String(district).toUpperCase()

    let refreshInfo = null
    try {
      refreshInfo = await refreshDistrictListings(districtUpper, {})
    } catch (err) {
      logger.warn(
        { err: err.message, district: districtUpper },
        'properties: auto-refresh failed, serving cached'
      )
    }

    let query = db
      .from('property_listings')
      .select('*')
      .eq('postcode_district', districtUpper)
      .eq('listing_type', listingType)

    if (min_price) query = query.gte('price', Number(min_price))
    if (max_price) query = query.lte('price', Number(max_price))
    if (min_beds) query = query.gte('bedrooms', Number(min_beds))
    if (max_beds) query = query.lte('bedrooms', Number(max_beds))
    if (property_type) query = query.eq('property_type', property_type)

    query = query.order('price', { ascending: true }).limit(200)

    const { data: listings, error } = await query
    if (error) throw error

    const { data: area } = await db
      .from('postcode_areas')
      .select('nursery_count_total, nursery_outstanding_pct')
      .eq('postcode_district', districtUpper)
      .maybeSingle()

    const { data: nearestOutstanding } = await db
      .from('nurseries')
      .select('name')
      .eq('registration_status', 'Active')
      .eq('ofsted_overall_grade', 'Outstanding')
      .like('postcode', `${districtUpper}%`)
      .limit(1)
      .maybeSingle()

    const overlay = {
      nursery_count_total: area?.nursery_count_total ?? null,
      nursery_outstanding_pct: area?.nursery_outstanding_pct ?? null,
      nearest_outstanding_name: nearestOutstanding?.name ?? null,
    }

    const enriched = (listings || []).map((row) => ({ ...row, nursery_overlay: overlay }))

    res.json({
      data: enriched,
      meta: {
        total: enriched.length,
        district: districtUpper,
        listing_type: listingType,
        fetched_at: refreshInfo?.fetched_at ?? null,
        cached: refreshInfo?.cached ?? null,
      },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/properties/:district/refresh — admin force refresh
router.post('/:district/refresh', adminAuth, async (req, res, next) => {
  try {
    const district = req.params.district.toUpperCase()
    logger.info({ district }, 'properties: manual refresh')
    const result = await refreshDistrictListings(district, { force: true })
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'properties: manual refresh failed')
    next(err)
  }
})

export default router
