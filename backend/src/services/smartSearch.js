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
  query,
  radius_km = 5,
  grade = null,
  funded_2yr = false,
  funded_3yr = false,
}) {
  const cleaned = query.trim()
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
      funded_2yr: Boolean(funded_2yr),
      funded_3yr: Boolean(funded_3yr),
    })
    if (error) throw error
    return {
      data: data || [],
      meta: {
        total: data?.length || 0,
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
  if (funded_2yr) q = q.gt('places_funded_2yr', 0)
  if (funded_3yr) q = q.gt('places_funded_3_4yr', 0)

  const { data, error } = await q
  if (error) throw error

  // Sort: Outstanding first, then by name
  const sorted = (data || []).sort((a, b) => {
    const ga = GRADE_ORDER[a.ofsted_overall_grade] || 99
    const gb = GRADE_ORDER[b.ofsted_overall_grade] || 99
    if (ga !== gb) return ga - gb
    return (a.name || '').localeCompare(b.name || '')
  })

  // For text search, centre map on first geocoded result if available
  const firstWithCoords = sorted.find((n) => n.lat != null && n.lng != null)

  return {
    data: sorted,
    meta: {
      total: sorted.length,
      search_lat: firstWithCoords?.lat ?? null,
      search_lng: firstWithCoords?.lng ?? null,
      mode: 'text',
      query: cleaned,
    },
  }
}
