// Index of Multiple Deprivation (IMD) 2019 ingestion.
// Free endpoint, no key:
//   https://imd-by-postcode.opendatacommunities.org/imd/2019/postcode/{postcode}
// Returns JSON with a `decile` (1 = most deprived, 10 = least deprived).

import db from '../db.js'
import { logger } from '../logger.js'

const BASE_URL = 'https://imd-by-postcode.opendatacommunities.org/imd/2019/postcode'
const RATE_LIMIT_MS = 250

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchImdDecileForPostcode(postcode) {
  if (!postcode) return null
  const url = `${BASE_URL}/${encodeURIComponent(postcode.trim())}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`imd api ${res.status}`)
    const json = await res.json()
    const decile = json?.decile ?? json?.data?.decile ?? null
    if (decile == null) return null
    const n = Number(decile)
    return Number.isFinite(n) ? n : null
  } finally {
    clearTimeout(timeout)
  }
}

// Look up a sample full postcode for a district — prefer the stored
// propertydata_sample_postcode, otherwise fall back to any active nursery.
async function sampleFullPostcode(district) {
  const { data: area } = await db
    .from('postcode_areas')
    .select('propertydata_sample_postcode')
    .eq('postcode_district', district)
    .maybeSingle()

  if (area?.propertydata_sample_postcode) return area.propertydata_sample_postcode

  const { data: nurseries } = await db
    .from('nurseries')
    .select('postcode')
    .eq('postcode_district', district)
    .eq('status', 'active')
    .not('postcode', 'is', null)
    .limit(1)

  return nurseries?.[0]?.postcode || null
}

export async function refreshImdForDistricts({ limit = 200, staleDays = 365 } = {}) {
  const staleCutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const { data: districts, error } = await db
    .from('postcode_areas')
    .select('postcode_district, imd_decile, imd_last_updated, nursery_count_total')
    .or(`imd_decile.is.null,imd_last_updated.is.null,imd_last_updated.lt.${staleCutoff}`)
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
      const postcode = await sampleFullPostcode(row.postcode_district)
      if (!postcode) {
        logger.warn(
          { district: row.postcode_district },
          'imd: no sample postcode available, skipping'
        )
        failed++
        continue
      }

      const decile = await fetchImdDecileForPostcode(postcode)
      if (decile == null) {
        logger.warn({ district: row.postcode_district, postcode }, 'imd: no decile returned')
        failed++
      } else {
        const { error: upErr } = await db
          .from('postcode_areas')
          .update({
            imd_decile: decile,
            imd_last_updated: new Date().toISOString(),
          })
          .eq('postcode_district', row.postcode_district)
        if (upErr) throw upErr
        processed++
        logger.debug({ district: row.postcode_district, decile }, 'imd: district updated')
      }
    } catch (err) {
      logger.error({ district: row.postcode_district, err: err.message }, 'imd: district failed')
      failed++
    }
    await sleep(RATE_LIMIT_MS)
  }

  return { processed, failed, total: districts.length }
}
