// Family Relocation Engine — "Where should my family live?"
//
// Scores UK postcode districts by nursery quality, school quality,
// affordability, safety, commute, green space and flood risk.
//
// Uses haversine distance for bulk commute estimation (OSRM is too slow
// for scanning thousands of districts). The detailed view can refine
// the top results with real OSRM travel times.

import db from '../db.js'
import { geocodePostcode } from './geocoding.js'
import { logger } from '../logger.js'

// ---------------------------------------------------------------------------
// Grade/rating ordering (higher index = better)
// ---------------------------------------------------------------------------
const OFSTED_GRADE_ORDER = ['Inadequate', 'Requires Improvement', 'Good', 'Outstanding']
const SCHOOL_RATING_ORDER = ['Inadequate', 'Requires Improvement', 'Good', 'Outstanding']

function gradeIndex(grade, scale = OFSTED_GRADE_ORDER) {
  if (!grade) return -1
  return scale.indexOf(grade)
}

function gradeAtLeast(grade, minGrade, scale = OFSTED_GRADE_ORDER) {
  return gradeIndex(grade, scale) >= gradeIndex(minGrade, scale)
}

// ---------------------------------------------------------------------------
// Haversine distance (km)
// ---------------------------------------------------------------------------
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ---------------------------------------------------------------------------
// Haversine-based commute estimate (minutes)
//   Walk:  5 km/h  → 12 min/km
//   Drive: 30 km/h → 2 min/km  (London average including traffic)
// ---------------------------------------------------------------------------
function estimateCommuteMin(fromLat, fromLng, toLat, toLng, mode = 'drive') {
  const km = haversineKm(fromLat, fromLng, toLat, toLng)
  const minPerKm = mode === 'walk' ? 12 : 2
  return Math.round(km * minPerKm)
}

// ---------------------------------------------------------------------------
// Scoring helpers (each returns 0–100)
// ---------------------------------------------------------------------------

function scoreNurseryQuality(matchingNurseries) {
  if (!matchingNurseries.length) return 0
  const outstanding = matchingNurseries.filter(
    (n) => n.ofsted_overall_grade === 'Outstanding'
  ).length
  const good = matchingNurseries.filter((n) => n.ofsted_overall_grade === 'Good').length
  const pctGoodPlus = ((outstanding + good) / matchingNurseries.length) * 100
  // Bonus for having more nurseries (up to 10 extra points for 10+ nurseries)
  const countBonus = Math.min(matchingNurseries.length, 10) * 1
  return Math.min(100, pctGoodPlus + countBonus)
}

function scoreSchoolQuality(matchingSchools) {
  if (!matchingSchools.length) return 0
  const outstanding = matchingSchools.filter((s) => s.ofsted_rating === 'Outstanding').length
  const good = matchingSchools.filter((s) => s.ofsted_rating === 'Good').length
  const pctGoodPlus = ((outstanding + good) / matchingSchools.length) * 100
  const countBonus = Math.min(matchingSchools.length, 10) * 1
  return Math.min(100, pctGoodPlus + countBonus)
}

function scoreAffordability(avgPrice, budgetMin, budgetMax) {
  if (!avgPrice || !budgetMax) return 50
  if (avgPrice <= budgetMin) return 100
  if (avgPrice >= budgetMax) return 0
  // Linear interpolation: cheaper within range = higher score
  return Math.round(((budgetMax - avgPrice) / (budgetMax - budgetMin)) * 100)
}

function scoreSafety(crimeRate) {
  if (crimeRate == null) return 50
  // UK average ≈ 80 per 1000. Scale: 0 crime = 100, 150+ = 0
  const maxCrime = 150
  return Math.max(0, Math.round(((maxCrime - crimeRate) / maxCrime) * 100))
}

function scoreCommute(commuteMinutes, maxCommuteMin) {
  if (commuteMinutes == null || !maxCommuteMin) return 50
  if (commuteMinutes <= 0) return 100
  if (commuteMinutes >= maxCommuteMin) return 0
  return Math.round(((maxCommuteMin - commuteMinutes) / maxCommuteMin) * 100)
}

function scoreGreenSpace(parkCount) {
  if (parkCount == null) return 50
  // 0 parks = 0, 5+ parks = 100
  return Math.min(100, parkCount * 20)
}

function scoreFloodSafety(floodLevel) {
  const scores = { 'Very Low': 100, Low: 75, Medium: 40, High: 10 }
  return scores[floodLevel] ?? 60
}

// ---------------------------------------------------------------------------
// Main engine
// ---------------------------------------------------------------------------
export async function findFamilyAreas(params) {
  const {
    budget_min = 0,
    budget_max,
    child_ages = [],
    work_postcodes = [],
    max_commute_min = 45,
    region,
    nursery_requirements = {},
    school_requirements = {},
    preferences = {},
  } = params

  if (!budget_max) throw new Error('budget_max is required')
  if (!child_ages.length) throw new Error('At least one child_age is required')

  logger.info(
    { budget_min, budget_max, region, work_postcodes, max_commute_min },
    'familyRelocation: starting search'
  )

  // 1. Geocode work postcodes
  const workLocations = []
  for (const pc of work_postcodes) {
    try {
      const loc = await geocodePostcode(pc)
      workLocations.push({ postcode: pc, ...loc })
    } catch (err) {
      logger.warn({ postcode: pc, err: err.message }, 'familyRelocation: work postcode geocode failed')
    }
  }

  // 2. Fetch candidate postcode areas within budget
  let query = db
    .from('postcode_areas')
    .select(
      `
      postcode_district, local_authority, region,
      avg_sale_price_all, avg_sale_price_flat, avg_sale_price_terraced,
      avg_sale_price_semi, avg_sale_price_detached,
      price_change_1yr_pct, price_growth_1yr_pct,
      crime_rate_per_1000, imd_decile,
      flood_risk_level, park_count_within_1km,
      nursery_count_total, nursery_count_outstanding, nursery_count_good,
      nursery_outstanding_pct,
      family_score, family_score_breakdown,
      lat, lng
    `
    )
    .not('lat', 'is', null)
    .not('avg_sale_price_all', 'is', null)
    .lte('avg_sale_price_all', budget_max)

  if (budget_min > 0) {
    query = query.gte('avg_sale_price_all', budget_min)
  }

  if (region) {
    query = query.ilike('region', `%${region}%`)
  }

  const { data: areas, error: areaError } = await query
  if (areaError) throw areaError

  logger.info({ candidateCount: areas?.length || 0 }, 'familyRelocation: candidate areas fetched')

  if (!areas || areas.length === 0) {
    return []
  }

  // 3. Filter by commute and compute commute times for each area
  let candidates = areas.map((area) => {
    const commutes = workLocations.map((work) => {
      const minutes = estimateCommuteMin(area.lat, area.lng, work.lat, work.lng, 'drive')
      return { postcode: work.postcode, minutes, distance_km: haversineKm(area.lat, area.lng, work.lat, work.lng) }
    })
    return { ...area, commutes }
  })

  // Filter out areas where ANY work commute exceeds the maximum
  if (workLocations.length > 0) {
    candidates = candidates.filter((c) =>
      c.commutes.every((comm) => comm.minutes <= max_commute_min)
    )
  }

  logger.info(
    { afterCommuteFilter: candidates.length },
    'familyRelocation: after commute filter'
  )

  if (candidates.length === 0) {
    return []
  }

  // 4. For each candidate, fetch nearby nurseries and schools
  //    We batch this: collect all district centers, then query nurseries/schools
  //    within ~2km of each using postcode prefix matching (fast, no PostGIS RPC needed)

  // Build postcode prefix lookup for nurseries and schools.
  // We query by postcode prefix in chunks (Supabase OR filter) — much faster
  // than N individual queries or PostGIS RPC calls for hundreds of districts.
  const districtPrefixes = candidates.map((c) => c.postcode_district)
  const nurseryMap = new Map() // district -> nurseries[]
  const schoolMap = new Map() // district -> schools[]

  // Process in chunks to avoid overly large queries
  const DISTRICT_CHUNK = 50
  for (let i = 0; i < districtPrefixes.length; i += DISTRICT_CHUNK) {
    const chunk = districtPrefixes.slice(i, i + DISTRICT_CHUNK)

    // Build OR filter for postcode prefix matching
    const orFilter = chunk.map((d) => `postcode.like.${d}%`).join(',')

    const [nurseryResult, schoolResult] = await Promise.all([
      db
        .from('nurseries')
        .select('postcode, ofsted_overall_grade, places_funded_2yr, places_funded_3_4yr, fee_avg_monthly')
        .eq('registration_status', 'Active')
        .or(orFilter)
        .limit(5000),
      db
        .from('schools')
        .select('postcode, phase, ofsted_rating')
        .not('postcode', 'is', null)
        .or(orFilter)
        .limit(5000),
    ])

    if (nurseryResult.error) {
      logger.warn({ err: nurseryResult.error.message }, 'familyRelocation: nursery query error')
    }
    if (schoolResult.error) {
      logger.warn({ err: schoolResult.error.message }, 'familyRelocation: school query error')
    }

    // Group nurseries by district prefix
    for (const n of nurseryResult.data || []) {
      if (!n.postcode) continue
      const district = n.postcode.trim().toUpperCase().split(' ')[0]
      if (!nurseryMap.has(district)) nurseryMap.set(district, [])
      nurseryMap.get(district).push(n)
    }

    // Group schools by district prefix
    for (const s of schoolResult.data || []) {
      if (!s.postcode) continue
      const district = s.postcode.trim().toUpperCase().split(' ')[0]
      if (!schoolMap.has(district)) schoolMap.set(district, [])
      schoolMap.get(district).push(s)
    }
  }

  // 5. Score each candidate
  const {
    min_grade = 'Good',
    funded_hours = false,
    max_walk_min,
  } = nursery_requirements

  const { phase: schoolPhase, min_rating = 'Good' } = school_requirements
  const { low_crime = false, green_space = false, flood_safe = false } = preferences

  const scored = candidates.map((area) => {
    const district = area.postcode_district
    let nearbyNurseries = nurseryMap.get(district) || []
    let nearbySchools = schoolMap.get(district) || []

    // Apply nursery filters
    const filteredNurseries = nearbyNurseries.filter((n) => {
      if (min_grade && !gradeAtLeast(n.ofsted_overall_grade, min_grade)) return false
      if (funded_hours && !n.places_funded_2yr && !n.places_funded_3_4yr) return false
      return true
    })

    // Apply school filters
    const filteredSchools = nearbySchools.filter((s) => {
      if (schoolPhase && s.phase !== schoolPhase) return false
      if (min_rating && !gradeAtLeast(s.ofsted_rating, min_rating, SCHOOL_RATING_ORDER)) return false
      return true
    })

    // Compute sub-scores
    const nurseryScore = scoreNurseryQuality(filteredNurseries)
    const schoolScore = scoreSchoolQuality(filteredSchools)
    const affordScore = scoreAffordability(area.avg_sale_price_all, budget_min, budget_max)
    const safetyScore = scoreSafety(area.crime_rate_per_1000)
    const worstCommute = area.commutes.length > 0
      ? Math.max(...area.commutes.map((c) => c.minutes))
      : 0
    const commuteScore = scoreCommute(worstCommute, max_commute_min)
    const greenScore = scoreGreenSpace(area.park_count_within_1km)
    const floodScore = scoreFloodSafety(area.flood_risk_level)

    // Weighted total (0–100)
    const overallScore = Math.round(
      nurseryScore * 0.30 +
      schoolScore * 0.20 +
      affordScore * 0.15 +
      safetyScore * 0.15 +
      commuteScore * 0.10 +
      greenScore * 0.05 +
      floodScore * 0.05
    )

    // Nursery summary
    const bestNurseryGrade = filteredNurseries.some((n) => n.ofsted_overall_grade === 'Outstanding')
      ? 'Outstanding'
      : filteredNurseries.some((n) => n.ofsted_overall_grade === 'Good')
        ? 'Good'
        : nearbyNurseries.length > 0
          ? nearbyNurseries[0]?.ofsted_overall_grade || 'Unknown'
          : 'None nearby'

    const avgFee = filteredNurseries.length > 0
      ? Math.round(
          filteredNurseries.reduce((sum, n) => sum + (n.fee_avg_monthly || 0), 0) /
          filteredNurseries.filter((n) => n.fee_avg_monthly).length || 0
        )
      : null

    // School summary
    const bestSchoolRating = filteredSchools.some((s) => s.ofsted_rating === 'Outstanding')
      ? 'Outstanding'
      : filteredSchools.some((s) => s.ofsted_rating === 'Good')
        ? 'Good'
        : nearbySchools.length > 0
          ? nearbySchools[0]?.ofsted_rating || 'Unknown'
          : 'None nearby'

    return {
      district: area.postcode_district,
      local_authority: area.local_authority,
      region: area.region,
      lat: Number(area.lat),
      lng: Number(area.lng),

      property: {
        avg_price: area.avg_sale_price_all,
        avg_price_flat: area.avg_sale_price_flat,
        avg_price_terraced: area.avg_sale_price_terraced,
        avg_price_semi: area.avg_sale_price_semi,
        avg_price_detached: area.avg_sale_price_detached,
        price_trend_1yr_pct: area.price_growth_1yr_pct ?? area.price_change_1yr_pct,
      },

      nursery_summary: {
        count: filteredNurseries.length,
        total_nearby: nearbyNurseries.length,
        best_grade: bestNurseryGrade,
        avg_monthly_fee: avgFee,
      },

      school_summary: {
        count: filteredSchools.length,
        total_nearby: nearbySchools.length,
        best_rating: bestSchoolRating,
      },

      area_data: {
        crime_rate_per_1000: area.crime_rate_per_1000 ? Number(area.crime_rate_per_1000) : null,
        imd_decile: area.imd_decile,
        flood_risk_level: area.flood_risk_level,
        family_score: area.family_score ? Number(area.family_score) : null,
        park_count: area.park_count_within_1km,
      },

      commutes: area.commutes,

      scores: {
        nursery: nurseryScore,
        school: schoolScore,
        affordability: affordScore,
        safety: safetyScore,
        commute: commuteScore,
        green_space: greenScore,
        flood_safety: floodScore,
      },

      match_score: overallScore,
    }
  })

  // 6. Sort by match score descending, return top 20
  scored.sort((a, b) => b.match_score - a.match_score)
  const results = scored.slice(0, 20)

  logger.info(
    { totalScored: scored.length, returned: results.length },
    'familyRelocation: search complete'
  )

  return results
}
