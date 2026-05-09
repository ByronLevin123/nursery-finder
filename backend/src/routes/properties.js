import express from 'express'
import db from '../db.js'
import { refreshDistrictListings } from '../services/propertyDataListings.js'
import { requireRole } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'
import { escapeLike } from '../utils.js'

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
      .like('postcode', `${escapeLike(districtUpper)}%`)
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

// GET /api/v1/properties/districts — Land Registry-backed district browser
// Free, no PropertyData credits needed. Ranks districts by affordability + nursery quality.
router.get('/districts', async (req, res, next) => {
  try {
    const {
      max_price,
      min_price,
      property_type = 'all',
      region,
      sort = 'price_asc',
      limit = 60,
    } = req.query

    const priceCol =
      property_type === 'flat'
        ? 'avg_sale_price_flat'
        : property_type === 'terraced'
          ? 'avg_sale_price_terraced'
          : property_type === 'semi'
            ? 'avg_sale_price_semi'
            : property_type === 'detached'
              ? 'avg_sale_price_detached'
              : 'avg_sale_price_all'

    let query = db
      .from('postcode_areas')
      .select(
        `
        postcode_district, local_authority, region,
        avg_sale_price_all, avg_sale_price_flat, avg_sale_price_terraced,
        avg_sale_price_semi, avg_sale_price_detached,
        rent_avg_weekly, gross_yield_pct, demand_rating, price_growth_1yr_pct,
        nursery_count_total, nursery_count_outstanding, nursery_outstanding_pct,
        family_score, crime_rate_per_1000, imd_decile, lat, lng
      `
      )
      .not(priceCol, 'is', null)

    if (region) query = query.eq('region', region)
    if (min_price) query = query.gte(priceCol, Number(min_price))
    if (max_price) query = query.lte(priceCol, Number(max_price))

    const ascending = sort !== 'price_desc' && sort !== 'family_score' && sort !== 'yield'
    if (sort === 'family_score') query = query.order('family_score', { ascending: false })
    else if (sort === 'yield') query = query.order('gross_yield_pct', { ascending: false })
    else query = query.order(priceCol, { ascending })

    query = query.limit(Math.min(Number(limit) || 60, 200))

    const { data, error } = await query
    if (error) throw error

    res.json({
      data: (data || []).map((d) => ({ ...d, price_displayed: d[priceCol] })),
      meta: { total: (data || []).length, price_column: priceCol, sort },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/properties/:district/refresh — admin force refresh
router.post('/:district/refresh', requireRole('admin'), async (req, res, next) => {
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
