// Smart search — auto-detects whether the query is a postcode or text
// Postcode → spatial search via PostGIS RPC
// Text     → full-text ilike across name/town/local_authority/address

import db from '../db.js'
import { geocodePostcode } from './geocoding.js'
import { logger } from '../logger.js'

const POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

const GRADE_ORDER = {
  Outstanding: 1,
  Good: 2,
  'Requires Improvement': 3,
  Inadequate: 4,
}

export function isPostcode(query) {
  return POSTCODE_REGEX.test(query.trim())
}

export async function smartSearch({
  query = '',
  lat = null,
  lng = null,
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
}) {
  // Direct coordinate search (from "Search this area" map interaction)
  if (lat != null && lng != null) {
    const { data, error } = await db.rpc('search_nurseries_near', {
      search_lat: lat,
      search_lng: lng,
      radius_km: Number(radius_km),
      grade_filter: grade || null,
      funded_2yr: Boolean(has_funded_2yr),
      funded_3yr: Boolean(has_funded_3yr),
    })
    if (error) throw error
    let filtered = applyAdvancedFilters(data || [], { has_availability, min_rating, provider_type, curriculum, sen, dietary, language })
    filtered.sort((a, b) => {
      const fa = a.featured ? 0 : 1
      const fb = b.featured ? 0 : 1
      if (fa !== fb) return fa - fb
      return (a.distance_km || 0) - (b.distance_km || 0)
    })
    return {
      data: filtered,
      meta: { total: filtered.length, search_lat: lat, search_lng: lng, mode: 'coordinates' },
    }
  }

  const cleaned = (query || '').trim()
  if (!cleaned) {
    return { data: [], meta: { total: 0, search_lat: null, search_lng: null, mode: 'empty' } }
  }

  // Postcode branch — reuse the existing PostGIS spatial search
  if (isPostcode(cleaned)) {
    const { lat, lng } = await geocodePostcode(cleaned)
    const { data, error } = await db.rpc('search_nurseries_near', {
      search_lat: lat,
      search_lng: lng,
      radius_km: Number(radius_km),
      grade_filter: grade || null,
      funded_2yr: Boolean(has_funded_2yr),
      funded_3yr: Boolean(has_funded_3yr),
    })
    if (error) throw error

    // Post-filter spatial results for advanced filters not handled by the RPC
    let filtered = data || []
    if (has_availability) filtered = filtered.filter((n) => n.spots_available > 0)
    if (min_rating) filtered = filtered.filter((n) => n.google_rating >= Number(min_rating))
    if (provider_type) filtered = filtered.filter((n) => n.provider_type === provider_type)
    if (has_funded_2yr) filtered = filtered.filter((n) => n.places_funded_2yr > 0)
    if (has_funded_3yr) filtered = filtered.filter((n) => n.places_funded_3_4yr > 0)
    if (curriculum) filtered = filtered.filter((n) => Array.isArray(n.curriculum_types) && n.curriculum_types.includes(curriculum))
    if (sen) filtered = filtered.filter((n) => n.sen_provision === true)
    if (dietary) filtered = filtered.filter((n) => Array.isArray(n.dietary_options) && n.dietary_options.includes(dietary))
    if (language) filtered = filtered.filter((n) => Array.isArray(n.languages) && n.languages.some((l) => l.toLowerCase().includes(language.toLowerCase())))

    // Boost featured nurseries to top within same distance band (1km bands)
    const boosted = filtered.sort((a, b) => {
      const bandA = Math.floor(a.distance_km || 0)
      const bandB = Math.floor(b.distance_km || 0)
      if (bandA !== bandB) return bandA - bandB
      // Within same 1km band, featured first
      const fa = a.featured ? 0 : 1
      const fb = b.featured ? 0 : 1
      if (fa !== fb) return fa - fb
      return (a.distance_km || 0) - (b.distance_km || 0)
    })

    return {
      data: boosted,
      meta: {
        total: boosted.length,
        search_lat: lat,
        search_lng: lng,
        mode: 'postcode',
      },
    }
  }

  // Text branch — ilike across name/town/local_authority/address
  const escaped = cleaned.replace(/[%_]/g, '\\$&')
  const pattern = `%${escaped}%`

  let q = db
    .from('nurseries')
    .select('*')
    .eq('registration_status', 'Active')
    .or(
      `name.ilike.${pattern},town.ilike.${pattern},local_authority.ilike.${pattern},address_line1.ilike.${pattern}`
    )
    .limit(50)

  if (grade) q = q.eq('ofsted_overall_grade', grade)
  if (has_funded_2yr) q = q.gt('places_funded_2yr', 0)
  if (has_funded_3yr) q = q.gt('places_funded_3_4yr', 0)
  if (has_availability) q = q.gt('spots_available', 0)
  if (min_rating) q = q.gte('google_rating', Number(min_rating))
  if (provider_type) q = q.eq('provider_type', provider_type)
  if (curriculum) q = q.contains('curriculum_types', [curriculum])
  if (sen) q = q.eq('sen_provision', true)
  if (dietary) q = q.contains('dietary_options', [dietary])

  const { data, error } = await q
  if (error) throw error

  // Post-filter for language (case-insensitive match on array column)
  let textFiltered = data || []
  if (language) {
    textFiltered = textFiltered.filter((n) => Array.isArray(n.languages) && n.languages.some((l) => l.toLowerCase().includes(language.toLowerCase())))
  }

  // Sort: featured first, then Outstanding first, then by name
  const sorted = (textFiltered).sort((a, b) => {
    // Featured nurseries (paid providers) float to top
    const fa = a.featured ? 0 : 1
    const fb = b.featured ? 0 : 1
    if (fa !== fb) return fa - fb
    const ga = GRADE_ORDER[a.ofsted_overall_grade] || 99
    const gb = GRADE_ORDER[b.ofsted_overall_grade] || 99
    if (ga !== gb) return ga - gb
    return (a.name || '').localeCompare(b.name || '')
  })

  // If text search returned results, return them
  if (sorted.length > 0) {
    const firstWithCoords = sorted.find((n) => n.lat != null && n.lng != null)
    return {
      data: sorted,
      meta: {
        total: sorted.length,
        search_lat: firstWithCoords?.lat ?? null,
        search_lng: firstWithCoords?.lng ?? null,
        mode: 'text',
        query: cleaned.replace(/[<>]/g, ''),
      },
    }
  }

  // Place name geocode + fuzzy fallback — run in parallel for speed
  logger.info({ query: cleaned }, 'text search empty, trying place geocode + fuzzy in parallel')

  const advancedFilters = { has_availability, min_rating, provider_type, curriculum, sen, dietary, language }

  async function tryPlaceGeocodeSearch() {
    const placeRes = await fetch(
      `https://api.postcodes.io/places?q=${encodeURIComponent(cleaned)}&limit=1`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!placeRes.ok) return null
    const placeData = await placeRes.json()
    if (!placeData.result || placeData.result.length === 0) return null
    const place = placeData.result[0]
    const placeLat = place.latitude
    const placeLng = place.longitude
    if (!placeLat || !placeLng) return null

    logger.info(
      { query: cleaned, place: place.name_1, lat: placeLat, lng: placeLng },
      'text search empty, resolved as place name'
    )
    const { data: placeNurseries, error: placeErr } = await db.rpc('search_nurseries_near', {
      search_lat: placeLat,
      search_lng: placeLng,
      radius_km: Number(radius_km),
      grade_filter: grade || null,
      funded_2yr: Boolean(has_funded_2yr),
      funded_3yr: Boolean(has_funded_3yr),
    })
    if (placeErr || !placeNurseries || placeNurseries.length === 0) return null

    let filtered = applyAdvancedFilters(placeNurseries, advancedFilters)

    return {
      data: filtered,
      meta: {
        total: filtered.length,
        search_lat: placeLat,
        search_lng: placeLng,
        mode: 'place',
        query: cleaned.replace(/[<>]/g, ''),
        place_name: place.name_1,
      },
    }
  }

  async function tryFuzzySearch() {
    const { data: fuzzyData, error: fuzzyError } = await db.rpc('fuzzy_search_nurseries', {
      query_text: cleaned,
      max_results: 50,
      min_similarity: 0.15,
    })

    if (fuzzyError) {
      logger.warn({ error: fuzzyError, query: cleaned }, 'fuzzy search RPC failed')
      return {
        data: [],
        meta: {
          total: 0,
          search_lat: null,
          search_lng: null,
          mode: 'text',
          query: cleaned.replace(/[<>]/g, ''),
        },
      }
    }

    let fuzzyResults = fuzzyData || []

    // Apply grade/funded/advanced filters client-side
    if (grade) fuzzyResults = fuzzyResults.filter((n) => n.ofsted_overall_grade === grade)
    if (has_funded_2yr) fuzzyResults = fuzzyResults.filter((n) => n.places_funded_2yr > 0)
    if (has_funded_3yr) fuzzyResults = fuzzyResults.filter((n) => n.places_funded_3_4yr > 0)
    fuzzyResults = applyAdvancedFilters(fuzzyResults, advancedFilters)

    // Sort: featured first, then by match_score descending
    fuzzyResults.sort((a, b) => {
      const fa = a.featured ? 0 : 1
      const fb = b.featured ? 0 : 1
      if (fa !== fb) return fa - fb
      return (b.match_score || 0) - (a.match_score || 0)
    })

    // Extract "did you mean" from the top match
    const topMatch = fuzzyResults[0]
    const didYouMean = topMatch?.matched_field || null

    const firstFuzzyWithCoords = fuzzyResults.find((n) => n.lat != null && n.lng != null)

    return {
      data: fuzzyResults,
      meta: {
        total: fuzzyResults.length,
        search_lat: firstFuzzyWithCoords?.lat ?? null,
        search_lng: firstFuzzyWithCoords?.lng ?? null,
        mode: 'fuzzy',
        query: cleaned.replace(/[<>]/g, ''),
        did_you_mean: didYouMean,
      },
    }
  }

  const [placeResult, fuzzyResult] = await Promise.allSettled([
    tryPlaceGeocodeSearch(),
    tryFuzzySearch(),
  ])

  // Return place result if it found something, otherwise fuzzy
  if (placeResult.status === 'fulfilled' && placeResult.value?.data?.length > 0) {
    return placeResult.value
  }
  if (fuzzyResult.status === 'fulfilled') {
    return fuzzyResult.value
  }

  // Both failed — return empty
  return {
    data: [],
    meta: {
      total: 0,
      search_lat: null,
      search_lng: null,
      mode: 'text',
      query: cleaned.replace(/[<>]/g, ''),
    },
  }
}

/** Apply advanced post-filters common to place geocode and postcode branches */
function applyAdvancedFilters(nurseries, filters) {
  let filtered = nurseries
  if (filters.has_availability) filtered = filtered.filter((n) => n.spots_available > 0)
  if (filters.min_rating) filtered = filtered.filter((n) => n.google_rating >= Number(filters.min_rating))
  if (filters.provider_type) filtered = filtered.filter((n) => n.provider_type === filters.provider_type)
  if (filters.curriculum) filtered = filtered.filter((n) => Array.isArray(n.curriculum_types) && n.curriculum_types.includes(filters.curriculum))
  if (filters.sen) filtered = filtered.filter((n) => n.sen_provision === true)
  if (filters.dietary) filtered = filtered.filter((n) => Array.isArray(n.dietary_options) && n.dietary_options.includes(filters.dietary))
  if (filters.language) filtered = filtered.filter((n) => Array.isArray(n.languages) && n.languages.some((l) => l.toLowerCase().includes(filters.language.toLowerCase())))
  return filtered
}
