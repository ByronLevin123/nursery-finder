// Police API crime data ingestion
// Free, no API key. Rate limit: 1 req/500ms (strictly enforced — we use 600ms).
// Endpoint: https://data.police.uk/api/crimes-street/all-crime?lat=..&lng=..&date=YYYY-MM
// Returns an array of crimes within a 1-mile radius of the point for one month.

import db from '../db.js'
import { logger } from '../logger.js'

const BASE_URL = 'https://data.police.uk/api'
const RATE_LIMIT_MS = 600

// Population proxy for crime-rate conversion.
// The police API returns crimes within a ~1-mile radius ≈ 3.14 km².
// Using a typical urban density of ~4,000 people/km² gives ~12,500 people.
// This is NOT an ONS-accurate population figure — it is a deliberately coarse
// proxy so crime rates across districts are comparable on a relative basis.
const POPULATION_PROXY = 12500

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Compute the YYYY-MM string for `offset` completed months before today.
// offset = 1 → previous month, 2 → month before that, etc.
function completedMonthString(offset) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function getCrimesForPoint(lat, lng, date) {
  const url = `${BASE_URL}/crimes-street/all-crime?lat=${lat}&lng=${lng}&date=${date}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      // Some months return 404 if data not yet published.
      if (res.status === 404) return []
      throw new Error(`police api ${res.status}`)
    }
    const json = await res.json()
    return Array.isArray(json) ? json : []
  } finally {
    clearTimeout(timeout)
  }
}

// Pure helper — exported for testability.
// Converts a raw crime count (summed across `monthsUsed` months) to a
// crime_rate_per_1000 using the population proxy.
export function computeCrimeRate(crimeCount, monthsUsed) {
  if (!monthsUsed || monthsUsed <= 0) return 0
  const monthlyAvg = crimeCount / monthsUsed
  return Number(((monthlyAvg * 1000) / POPULATION_PROXY).toFixed(2))
}

// Fetch crimes for the last N completed months and return the total.
export async function fetchCrimeCountForDistrict({ lat, lng, months = 3 }) {
  let total = 0
  const periods = []
  let monthsUsed = 0
  for (let offset = 1; offset <= months; offset++) {
    const date = completedMonthString(offset)
    try {
      const crimes = await getCrimesForPoint(lat, lng, date)
      total += crimes.length
      monthsUsed++
      periods.push(date)
    } catch (err) {
      logger.warn({ date, err: err.message }, 'police: month fetch failed')
    }
    // Respect rate limit between every request.
    if (offset < months) await sleep(RATE_LIMIT_MS)
  }
  return {
    crime_count: total,
    months_used: monthsUsed,
    period_start: periods[periods.length - 1] || null,
    period_end: periods[0] || null,
  }
}

// Refresh crime stats for districts whose data is null or older than staleDays.
export async function refreshCrimeForDistricts({ limit = 50, staleDays = 30 } = {}) {
  const staleCutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: districts, error } = await db
    .from('postcode_areas')
    .select('postcode_district, lat, lng, nursery_count_total, crime_last_updated')
    .or(`crime_last_updated.is.null,crime_last_updated.lt.${staleCutoff.split('T')[0]}`)
    .not('lat', 'is', null)
    .order('nursery_count_total', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw error
  if (!districts || districts.length === 0) {
    return { processed: 0, failed: 0, total: 0 }
  }

  let processed = 0
  let failed = 0

  for (const row of districts) {
    try {
      const { crime_count, months_used } = await fetchCrimeCountForDistrict({
        lat: row.lat,
        lng: row.lng,
        months: 3,
      })

      if (months_used === 0) {
        logger.warn({ district: row.postcode_district }, 'police: no months fetched')
        failed++
        await sleep(RATE_LIMIT_MS)
        continue
      }

      const crimeRate = computeCrimeRate(crime_count, months_used)

      const { error: upErr } = await db
        .from('postcode_areas')
        .update({
          crime_rate_per_1000: crimeRate,
          crime_last_updated: new Date().toISOString(),
        })
        .eq('postcode_district', row.postcode_district)

      if (upErr) throw upErr

      processed++
      logger.debug(
        { district: row.postcode_district, crime_count, months_used, crimeRate },
        'police: district updated'
      )
    } catch (err) {
      logger.error({ district: row.postcode_district, err: err.message }, 'police: district failed')
      failed++
    }

    await sleep(RATE_LIMIT_MS)
  }

  return { processed, failed, total: districts.length }
}
