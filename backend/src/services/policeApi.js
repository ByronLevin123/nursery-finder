// Police API crime data ingestion
// Free, no API key. Rate limit: 1 req/500ms (strictly enforced)

import axios from 'axios'
import db from '../db.js'
import { logger } from '../logger.js'

const BASE_URL = 'https://data.police.uk/api'
const RATE_LIMIT_MS = 600

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getCrimesForPoint(lat, lng, date) {
  const response = await axios.get(`${BASE_URL}/crimes-street/all-crime`, {
    params: { lat, lng, date },
    timeout: 15000,
  })
  return response.data
}

export async function ingestCrimeDataBatch(districts) {
  let processed = 0
  let failed = 0

  const date = new Date()
  date.setMonth(date.getMonth() - 2)
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

  for (const district of districts) {
    try {
      const { data: area } = await db
        .from('postcode_areas')
        .select('lat, lng, postcode_district')
        .eq('postcode_district', district)
        .single()

      if (!area?.lat || !area?.lng) {
        logger.warn({ district }, 'police: no centroid for district, skipping')
        failed++
        continue
      }

      const crimes = await getCrimesForPoint(area.lat, area.lng, dateStr)

      const byCategory = {}
      crimes.forEach(crime => {
        byCategory[crime.category] = (byCategory[crime.category] || 0) + 1
      })

      const populationEstimate = 15000
      const crimeRate = (crimes.length / populationEstimate) * 1000

      await db.from('postcode_areas').update({
        crime_rate_per_1000: crimeRate,
        crime_categories: byCategory,
        crime_last_updated: new Date().toISOString().split('T')[0],
      }).eq('postcode_district', district)

      processed++
      logger.debug({ district, crimes: crimes.length, crimeRate }, 'police: district processed')

    } catch (err) {
      logger.error({ district, err: err.message }, 'police: district failed')
      failed++
    }

    await sleep(RATE_LIMIT_MS)
  }

  return { processed, failed }
}
