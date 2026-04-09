// Travel-time service using the OSRM public demo server.
// No API key. Free. Rate limited to 1 request / 200ms in-process.
// Falls back to haversine-based estimates if OSRM is unreachable.

import crypto from 'crypto'
import axios from 'axios'
import db from '../db.js'
import { logger } from '../logger.js'

const OSRM_URL = process.env.OSRM_URL || 'https://router.project-osrm.org'

const MODE_TO_PROFILE = {
  walk: 'foot',
  cycle: 'bike',
  drive: 'car',
}

// Rough fallback speeds (minutes per km).
const FALLBACK_MIN_PER_KM = {
  walk: 12,
  cycle: 4,
  drive: 1.5,
}

// ---------------------------------------------------------------------------
// Rate limiter — 1 request every 200ms.
// ---------------------------------------------------------------------------
let lastRequestAt = 0
async function rateLimit() {
  const now = Date.now()
  const wait = Math.max(0, lastRequestAt + 200 - now)
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait))
  }
  lastRequestAt = Date.now()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function round4(n) {
  return Math.round(Number(n) * 10000) / 10000
}

export function cacheKey({ fromLat, fromLng, toLat, toLng, mode }) {
  const from = `${round4(fromLat)},${round4(fromLng)}`
  const to = `${round4(toLat)},${round4(toLng)}`
  const raw = `${from}|${to}|${mode}`
  return crypto.createHash('sha1').update(raw).digest('hex')
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function haversineFallback({ fromLat, fromLng, toLat, toLng, mode }) {
  const distanceKm = haversineKm(fromLat, fromLng, toLat, toLng)
  const minPerKm = FALLBACK_MIN_PER_KM[mode] ?? FALLBACK_MIN_PER_KM.drive
  const durationS = Math.round(distanceKm * minPerKm * 60)
  return {
    duration_s: durationS,
    distance_m: Math.round(distanceKm * 1000),
    fallback: true,
  }
}

// ---------------------------------------------------------------------------
// Cache (DB-backed)
// ---------------------------------------------------------------------------
async function readCache(key) {
  if (!db) return null
  try {
    const { data, error } = await db
      .from('travel_time_cache')
      .select('duration_s, distance_m')
      .eq('key', key)
      .maybeSingle()
    if (error) return null
    return data || null
  } catch {
    return null
  }
}

async function writeCache(key, row) {
  if (!db) return
  try {
    await db.from('travel_time_cache').upsert(
      {
        key,
        from_lat: row.fromLat,
        from_lng: row.fromLng,
        to_lat: row.toLat,
        to_lng: row.toLng,
        mode: row.mode,
        duration_s: row.duration_s,
        distance_m: row.distance_m,
      },
      { onConflict: 'key' }
    )
  } catch (err) {
    logger.warn({ err: err.message }, 'travel cache write failed')
  }
}

// ---------------------------------------------------------------------------
// Main: single route
// ---------------------------------------------------------------------------
export async function getTravelTime({ fromLat, fromLng, toLat, toLng, mode = 'walk' }) {
  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng)
  ) {
    throw new Error('fromLat/fromLng/toLat/toLng are required')
  }
  const profile = MODE_TO_PROFILE[mode]
  if (!profile) throw new Error(`Unknown mode: ${mode}`)

  const key = cacheKey({ fromLat, fromLng, toLat, toLng, mode })
  const cached = await readCache(key)
  if (cached) {
    return { ...cached, mode, cached: true }
  }

  try {
    await rateLimit()
    const url =
      `${OSRM_URL}/route/v1/${profile}/` + `${fromLng},${fromLat};${toLng},${toLat}?overview=false`
    const resp = await axios.get(url, { timeout: 8000 })
    const route = resp.data?.routes?.[0]
    if (!route) throw new Error('no route')
    const result = {
      duration_s: Math.round(route.duration),
      distance_m: Math.round(route.distance),
    }
    await writeCache(key, { fromLat, fromLng, toLat, toLng, mode, ...result })
    return { ...result, mode, cached: false }
  } catch (err) {
    logger.warn({ err: err.message, mode }, 'OSRM route failed — using fallback')
    const fb = haversineFallback({ fromLat, fromLng, toLat, toLng, mode })
    return {
      duration_s: fb.duration_s,
      distance_m: fb.distance_m,
      mode,
      cached: false,
      fallback: true,
    }
  }
}

// ---------------------------------------------------------------------------
// Batch: OSRM Table API
//   from: {lat, lng}
//   to:   [{lat, lng}, ...]
//   mode: 'walk'|'cycle'|'drive'
// Returns array of {duration_s, distance_m, fallback?}
// ---------------------------------------------------------------------------
export async function getTravelMatrix({ from, to, mode = 'walk' }) {
  const profile = MODE_TO_PROFILE[mode]
  if (!profile) throw new Error(`Unknown mode: ${mode}`)
  if (!from || !Array.isArray(to) || to.length === 0) return []

  // Chunk to 99 destinations per request (keeps URL size sensible).
  const CHUNK = 90
  const out = []
  for (let i = 0; i < to.length; i += CHUNK) {
    const chunk = to.slice(i, i + CHUNK)
    const coords = [from, ...chunk].map((p) => `${p.lng},${p.lat}`).join(';')
    const sources = '0'
    const destinations = chunk.map((_, j) => j + 1).join(';')
    const url =
      `${OSRM_URL}/table/v1/${profile}/${coords}` +
      `?sources=${sources}&destinations=${destinations}&annotations=duration,distance`

    try {
      await rateLimit()
      const resp = await axios.get(url, { timeout: 12000 })
      const durations = resp.data?.durations?.[0] || []
      const distances = resp.data?.distances?.[0] || []
      for (let j = 0; j < chunk.length; j++) {
        const d = durations[j]
        const m = distances[j]
        if (d == null || m == null) {
          out.push(
            haversineFallback({
              fromLat: from.lat,
              fromLng: from.lng,
              toLat: chunk[j].lat,
              toLng: chunk[j].lng,
              mode,
            })
          )
        } else {
          out.push({ duration_s: Math.round(d), distance_m: Math.round(m) })
        }
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'OSRM table failed — falling back')
      for (const p of chunk) {
        out.push(
          haversineFallback({
            fromLat: from.lat,
            fromLng: from.lng,
            toLat: p.lat,
            toLng: p.lng,
            mode,
          })
        )
      }
    }
  }
  return out
}
