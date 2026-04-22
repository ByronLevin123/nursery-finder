// School data ingestion service
// Parses CSV from GIAS (Get Information about Schools) and upserts into schools table
// Geocodes postcodes using the existing geocoding service

import axios from 'axios'
import csv from 'csv-parser'
import { Readable } from 'stream'
import db from '../db.js'
import { logger } from '../logger.js'

const BATCH_SIZE = 200
const POSTCODES_IO_BULK = 'https://api.postcodes.io/postcodes'
const GEOCODE_BATCH_SIZE = 100
const GEOCODE_DELAY_MS = 500

// Ofsted rating mapping from numeric codes
const RATING_MAP = {
  '1': 'Outstanding',
  '2': 'Good',
  '3': 'Requires Improvement',
  '4': 'Inadequate',
}

function mapCsvRow(row) {
  // GIAS CSV column names — adapt as needed when CSV format changes
  const urn = (row['URN'] || row['urn'] || '').trim()
  const name = (row['EstablishmentName'] || row['SchoolName'] || row['name'] || '').trim()

  if (!urn || !name) return null

  const phase = (row['PhaseOfEducation (name)'] || row['Phase'] || row['phase'] || '').trim()
  const type = (row['TypeOfEstablishment (name)'] || row['Type'] || row['type'] || '').trim()

  // Map Ofsted rating — could be numeric or text
  let ofstedRating = (row['OfstedRating (name)'] || row['OfstedRating'] || row['ofsted_rating'] || '').trim()
  if (RATING_MAP[ofstedRating]) ofstedRating = RATING_MAP[ofstedRating]
  if (!['Outstanding', 'Good', 'Requires Improvement', 'Inadequate'].includes(ofstedRating)) {
    ofstedRating = null
  }

  const lastInspection = (row['OfstedLastInsp'] || row['last_inspection_date'] || '').trim() || null

  const address = [
    row['Street'],
    row['Locality'],
    row['Address3'],
  ].filter(Boolean).map(s => s.trim()).join(', ') || (row['address'] || '').trim() || null

  const town = (row['Town'] || row['town'] || '').trim() || null
  const postcode = (row['Postcode'] || row['postcode'] || '').trim().toUpperCase() || null
  const localAuthority = (row['LA (name)'] || row['local_authority'] || '').trim() || null

  const pupils = parseInt(row['NumberOfPupils'] || row['pupils']) || null
  const ageRange = (() => {
    const low = row['StatutoryLowAge'] || row['age_low']
    const high = row['StatutoryHighAge'] || row['age_high']
    if (low && high) return `${low}-${high}`
    return (row['age_range'] || '').trim() || null
  })()

  const website = (row['SchoolWebsite'] || row['website'] || '').trim() || null

  return {
    urn,
    name,
    type: type || null,
    phase: phase || null,
    ofsted_rating: ofstedRating,
    last_inspection_date: lastInspection || null,
    address,
    town,
    postcode,
    local_authority: localAuthority,
    pupils,
    age_range: ageRange,
    website: website ? (website.startsWith('http') ? website : `https://${website}`) : null,
  }
}

/**
 * Ingest school data from a CSV URL.
 * @param {string} csvUrl - URL to the CSV file (GIAS download or hosted CSV)
 */
export async function ingestSchoolsFromCsv(csvUrl) {
  const startTime = Date.now()
  let imported = 0
  let skipped = 0
  let errors = 0

  logger.info({ csvUrl }, 'schools: downloading CSV')
  const response = await axios.get(csvUrl, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'NurseryMatch/1.0 (data@nurserymatch.com)' },
  })

  const rawCsv = Buffer.from(response.data).toString('utf-8')

  const records = []
  await new Promise((resolve, reject) => {
    Readable.from(rawCsv)
      .pipe(csv())
      .on('data', (row) => {
        const mapped = mapCsvRow(row)
        if (mapped) {
          records.push(mapped)
        } else {
          skipped++
        }
      })
      .on('end', resolve)
      .on('error', reject)
  })

  logger.info({ total: records.length, skipped }, 'schools: CSV parsed, starting upsert')

  // Upsert in batches
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { error } = await db.from('schools').upsert(batch, {
      onConflict: 'urn',
      ignoreDuplicates: false,
    })

    if (error) {
      logger.error({ error: error.message, batchStart: i }, 'schools: batch upsert failed')
      errors += batch.length
    } else {
      imported += batch.length
    }

    if (i % 2000 === 0) {
      logger.info({ imported, remaining: records.length - i }, 'schools: progress')
    }
  }

  const duration = Date.now() - startTime
  logger.info({ imported, skipped, errors, duration_ms: duration }, 'schools: ingest complete')
  return { imported, skipped, errors, duration_ms: duration }
}

/**
 * Geocode schools that have a postcode but no lat/lng.
 * Uses Postcodes.io bulk endpoint, same pattern as nursery geocoding.
 */
export async function geocodeSchoolsBatch(limit = 500) {
  const { data: schools, error } = await db
    .from('schools')
    .select('id, postcode')
    .is('lat', null)
    .not('postcode', 'is', null)
    .limit(limit)

  if (error) throw error
  if (!schools?.length) {
    logger.info('schools geocoding: no schools to geocode')
    return { geocoded: 0, failed: 0 }
  }

  logger.info({ count: schools.length }, 'schools geocoding: starting batch')

  const chunks = []
  for (let i = 0; i < schools.length; i += GEOCODE_BATCH_SIZE) {
    chunks.push(schools.slice(i, i + GEOCODE_BATCH_SIZE))
  }

  let totalGeocoded = 0
  let totalFailed = 0
  const normalize = (pc) => (pc || '').trim().toUpperCase().replace(/\s+/g, '')

  for (const chunk of chunks) {
    const postcodes = chunk.map((s) => s.postcode)

    // Build lookup map — multiple schools can share a postcode
    const pcMap = new Map()
    for (const s of chunk) {
      const key = normalize(s.postcode)
      if (!pcMap.has(key)) pcMap.set(key, [])
      pcMap.get(key).push(s.id)
    }

    try {
      const response = await axios.post(POSTCODES_IO_BULK, { postcodes })
      const results = response.data.result

      if (!results) {
        logger.error('schools geocoding: unexpected API response')
        totalFailed += chunk.length
        continue
      }

      for (const result of results) {
        if (result.result) {
          const ids = pcMap.get(normalize(result.query)) || []
          for (const id of ids) {
            const { error: updateErr } = await db
              .from('schools')
              .update({ lat: result.result.latitude, lng: result.result.longitude })
              .eq('id', id)
            if (updateErr) {
              logger.error({ id, err: updateErr.message }, 'schools geocoding: update failed')
              totalFailed++
            } else {
              totalGeocoded++
            }
          }
        } else {
          const ids = pcMap.get(normalize(result.query)) || []
          totalFailed += Math.max(ids.length, 1)
          logger.warn({ postcode: result.query }, 'schools geocoding: postcode not found')
        }
      }
    } catch (err) {
      logger.error({ err: err.message }, 'schools geocoding: chunk failed')
      totalFailed += chunk.length
    }

    await new Promise((resolve) => setTimeout(resolve, GEOCODE_DELAY_MS))
  }

  logger.info({ geocoded: totalGeocoded, failed: totalFailed }, 'schools geocoding: complete')
  return { geocoded: totalGeocoded, failed: totalFailed }
}
