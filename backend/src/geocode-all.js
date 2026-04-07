// One-off: geocode every active nursery missing lat/lng
// Loops geocodeNurseriesBatch until the queue is empty.
import 'dotenv/config'
import { geocodeNurseriesBatch } from './services/geocoding.js'
import { logger } from './logger.js'

const BATCH = 500
let totalGeocoded = 0
let totalFailed = 0
let round = 0

while (true) {
  round++
  const { geocoded, failed } = await geocodeNurseriesBatch(BATCH)
  totalGeocoded += geocoded
  totalFailed += failed
  logger.info({ round, geocoded, failed, totalGeocoded, totalFailed }, 'geocode-all: round complete')
  if (geocoded === 0) break
}

logger.info({ totalGeocoded, totalFailed, rounds: round }, 'geocode-all: DONE')
process.exit(0)
