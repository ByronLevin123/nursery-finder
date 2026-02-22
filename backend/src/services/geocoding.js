// Geocoding service using Postcodes.io
// Uses BULK endpoint — 100 postcodes per request, free, no API key

import axios from 'axios'
import { geocodeCache } from './cache.js'
import db from '../db.js'
import { logger } from '../logger.js'

const POSTCODES_IO_BULK = 'https://api.postcodes.io/postcodes'
const BATCH_SIZE = 100
const BATCH_DELAY_MS = 500

// Geocode a single postcode (for search queries — uses cache)
export async function geocodePostcode(postcode) {
  const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, ' ')
  const cached = geocodeCache.get(cleaned)
  if (cached) return cached

  const response = await axios.get(`${POSTCODES_IO_BULK}/${encodeURIComponent(cleaned)}`)

  if (response.data.status !== 200 || !response.data.result) {
    throw new Error(`Postcode not found: ${postcode}`)
  }

  const { latitude, longitude } = response.data.result
  const result = { lat: latitude, lng: longitude }
  geocodeCache.set(cleaned, result)
  return result
}

// Bulk geocode nurseries with null location — run nightly
export async function geocodeNurseriesBatch(limit = 500) {
  const { data: nurseries, error } = await db
    .from('nurseries')
    .select('id, postcode')
    .eq('registration_status', 'Active')
    .is('lat', null)
    .not('postcode', 'is', null)
    .limit(limit)

  if (error) throw error
  if (!nurseries?.length) {
    logger.info('geocoding: no nurseries to geocode')
    return { geocoded: 0, failed: 0 }
  }

  logger.info({ count: nurseries.length }, 'geocoding: starting batch')

  const chunks = []
  for (let i = 0; i < nurseries.length; i += BATCH_SIZE) {
    chunks.push(nurseries.slice(i, i + BATCH_SIZE))
  }

  let totalGeocoded = 0
  let totalFailed = 0

  for (const chunk of chunks) {
    const postcodes = chunk.map(n => n.postcode)

    try {
      const response = await axios.post(POSTCODES_IO_BULK, { postcodes })
      const results = response.data.result

      const updates = []
      for (const result of results) {
        if (result.result) {
          updates.push({
            id: chunk.find(n => n.postcode === result.query)?.id,
            lat: result.result.latitude,
            lng: result.result.longitude,
          })
        } else {
          totalFailed++
          logger.warn({ postcode: result.query }, 'geocoding: postcode not found')
        }
      }

      for (const update of updates) {
        if (update.id) {
          await db
            .from('nurseries')
            .update({ lat: update.lat, lng: update.lng })
            .eq('id', update.id)
          totalGeocoded++
        }
      }

      logger.info({ geocoded: totalGeocoded }, 'geocoding: chunk complete')

    } catch (err) {
      logger.error({ err: err.message }, 'geocoding: chunk failed')
      totalFailed += chunk.length
    }

    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
  }

  return { geocoded: totalGeocoded, failed: totalFailed }
}
