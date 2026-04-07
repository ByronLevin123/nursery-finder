// Parks / greenspace via OpenStreetMap Overpass API
// Free, no key. Policy: max 1 req/sec — we sleep 1100ms between calls.
// Endpoint: https://overpass-api.de/api/interpreter

import db from '../db.js'
import { logger } from '../logger.js'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const FETCH_TIMEOUT_MS = 30000
const RATE_LIMIT_MS = 1100

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// Haversine — metres
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

// Pure helper — exported for tests.
// Accepts an Overpass JSON response and an optional origin {lat,lng}; if origin is
// supplied, distance_m is computed via haversine, otherwise distance_m is null.
export function parseOverpassParks(json, origin = null) {
  if (!json || typeof json !== 'object') return []
  const elements = Array.isArray(json.elements) ? json.elements : []
  const parks = []
  for (const el of elements) {
    const tags = el.tags || {}
    const name = tags.name || tags['official_name'] || null
    let lat = null
    let lng = null
    if (typeof el.lat === 'number' && typeof el.lon === 'number') {
      lat = el.lat
      lng = el.lon
    } else if (el.center && typeof el.center.lat === 'number') {
      lat = el.center.lat
      lng = el.center.lon
    }
    if (lat == null || lng == null) continue
    let distance_m = null
    if (origin && typeof origin.lat === 'number' && typeof origin.lng === 'number') {
      distance_m = haversine(origin.lat, origin.lng, lat, lng)
    }
    parks.push({ name, lat, lng, distance_m })
  }
  parks.sort((a, b) => {
    if (a.distance_m == null) return 1
    if (b.distance_m == null) return -1
    return a.distance_m - b.distance_m
  })
  return parks
}

export async function fetchParksNearLatLng(lat, lng) {
  const query = `[out:json][timeout:25];(way["leisure"="park"](around:1500,${lat},${lng});relation["leisure"="park"](around:1500,${lat},${lng}););out center tags;`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`overpass ${res.status}`)
    const json = await res.json()
    return parseOverpassParks(json, { lat, lng })
  } finally {
    clearTimeout(timeout)
  }
}

export async function refreshParksForDistrict(district) {
  const districtUpper = String(district).toUpperCase()
  const { data: area, error } = await db
    .from('postcode_areas')
    .select('postcode_district, lat, lng')
    .eq('postcode_district', districtUpper)
    .maybeSingle()
  if (error) throw error
  if (!area || area.lat == null || area.lng == null) {
    logger.warn({ district: districtUpper }, 'parks: district has no centroid')
    return { district: districtUpper, updated: false }
  }
  const parks = await fetchParksNearLatLng(area.lat, area.lng)
  const within1km = parks.filter((p) => p.distance_m != null && p.distance_m <= 1000).length
  const nearest = parks[0] || null
  const { error: upErr } = await db
    .from('postcode_areas')
    .update({
      nearest_park_name: nearest?.name ?? null,
      nearest_park_distance_m: nearest?.distance_m ?? null,
      park_count_within_1km: within1km,
      parks_updated_at: new Date().toISOString(),
    })
    .eq('postcode_district', districtUpper)
  if (upErr) throw upErr
  logger.info(
    { district: districtUpper, nearest: nearest?.name, within1km },
    'parks: district updated'
  )
  return { district: districtUpper, updated: true, nearest, within1km }
}

export async function refreshAllParks({ limit = 200 } = {}) {
  const { data: districts, error } = await db
    .from('postcode_areas')
    .select('postcode_district, lat, lng, parks_updated_at')
    .is('parks_updated_at', null)
    .not('lat', 'is', null)
    .order('nursery_count_total', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw error
  if (!districts?.length) return { processed: 0, failed: 0, total: 0 }

  let processed = 0
  let failed = 0
  for (const row of districts) {
    try {
      await refreshParksForDistrict(row.postcode_district)
      processed++
    } catch (err) {
      logger.error({ district: row.postcode_district, err: err.message }, 'parks: district failed')
      failed++
    }
    await sleep(RATE_LIMIT_MS)
  }
  return { processed, failed, total: districts.length }
}
