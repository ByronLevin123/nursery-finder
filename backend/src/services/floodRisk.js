// Environment Agency Flood Monitoring API
// Free, no key. Endpoint: https://environment.data.gov.uk/flood-monitoring/id/floodAreas
//
// LIMITATION: The EA flood-monitoring API exposes flood *warning areas* and current
// alerts, not a per-point "risk band". There is no public free endpoint that returns
// the official EA "Risk of Flooding from Rivers and Sea" band for an arbitrary point.
// We approximate by counting nearby flood areas + active warnings within a radius and
// bucketing into Very Low / Low / Medium / High. When no data is available we return
// null and the UI shows an "unknown" badge.

import db from '../db.js'
import { logger } from '../logger.js'

const BASE_URL = 'https://environment.data.gov.uk/flood-monitoring'
const FETCH_TIMEOUT_MS = 10000

// Pure helper — exported for tests.
// Accepts the JSON response from /id/floodAreas?lat=&long=&dist= (or /id/floods)
// and returns { level, area_count }.
export function parseFloodResponse(json) {
  if (!json || typeof json !== 'object') return { level: null, area_count: 0 }
  const items = Array.isArray(json.items) ? json.items : []
  const count = items.length

  // If items carry a `severityLevel` (1=severe, 2=warning, 3=alert, 4=no longer)
  // we use the most severe one. Otherwise we fall back on raw count.
  let minSeverity = null
  for (const it of items) {
    const s = typeof it.severityLevel === 'number' ? it.severityLevel : null
    if (s != null && (minSeverity == null || s < minSeverity)) minSeverity = s
  }

  let level = null
  if (minSeverity != null) {
    if (minSeverity === 1) level = 'High'
    else if (minSeverity === 2) level = 'High'
    else if (minSeverity === 3) level = 'Medium'
    else level = 'Low'
  } else if (count === 0) {
    level = 'Very Low'
  } else if (count <= 2) {
    level = 'Low'
  } else if (count <= 6) {
    level = 'Medium'
  } else {
    level = 'High'
  }

  return { level, area_count: count }
}

export async function fetchFloodRiskForArea(lat, lng) {
  const url = `${BASE_URL}/id/floodAreas?lat=${lat}&long=${lng}&dist=2`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`ea flood api ${res.status}`)
    const json = await res.json()
    return parseFloodResponse(json)
  } finally {
    clearTimeout(timeout)
  }
}

export async function refreshFloodRiskForDistrict(district) {
  const districtUpper = String(district).toUpperCase()
  const { data: area, error } = await db
    .from('postcode_areas')
    .select('postcode_district, lat, lng')
    .eq('postcode_district', districtUpper)
    .maybeSingle()
  if (error) throw error
  if (!area || area.lat == null || area.lng == null) {
    logger.warn({ district: districtUpper }, 'flood: district has no centroid')
    return { district: districtUpper, updated: false }
  }
  const { level, area_count } = await fetchFloodRiskForArea(area.lat, area.lng)
  const { error: upErr } = await db
    .from('postcode_areas')
    .update({
      flood_risk_level: level,
      flood_updated_at: new Date().toISOString(),
    })
    .eq('postcode_district', districtUpper)
  if (upErr) throw upErr
  logger.info({ district: districtUpper, level, area_count }, 'flood: district updated')
  return { district: districtUpper, level, area_count, updated: true }
}

export async function refreshAllFloodRisk({ limit = 100, staleDays = 30 } = {}) {
  const staleCutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
  const { data: districts, error } = await db
    .from('postcode_areas')
    .select('postcode_district, lat, lng, flood_updated_at')
    .or(`flood_updated_at.is.null,flood_updated_at.lt.${staleCutoff}`)
    .not('lat', 'is', null)
    .order('nursery_count_total', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw error
  if (!districts?.length) return { processed: 0, failed: 0, total: 0 }

  let processed = 0
  let failed = 0
  for (const row of districts) {
    try {
      await refreshFloodRiskForDistrict(row.postcode_district)
      processed++
    } catch (err) {
      logger.error({ district: row.postcode_district, err: err.message }, 'flood: district failed')
      failed++
    }
  }
  return { processed, failed, total: districts.length }
}
