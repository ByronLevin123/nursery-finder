// Schools ingestion (DfE GIAS — Get Information About Schools)
//
// GIAS does not publish a stable public REST API. The simplest free source is the
// "edubasealldata" CSV available from https://get-information-schools.service.gov.uk/Downloads
// The download URL changes each month (e.g. edubasealldata20260301.csv) so update
// SCHOOLS_CSV_URL below or pass `csvUrl` into the route.
//
// HOW TO UPDATE:
//   1. Visit https://get-information-schools.service.gov.uk/Downloads
//   2. Pick "Establishment fields CSV" (All establishment data)
//   3. Copy the resolved CSV URL into SCHOOLS_CSV_URL or POST it to /api/v1/overlays/schools/ingest

import axios from 'axios'
import csv from 'csv-parser'
import db from '../db.js'
import { logger } from '../logger.js'
import { geocodePostcode } from './geocoding.js'

export const SCHOOLS_CSV_URL =
  'https://ea-edubase-api-prod.azurewebsites.net/edubase/edubasealldata.csv'

const BATCH_SIZE = 500

// Pure parser — exported for tests.
// Maps a GIAS row (object keyed by header) to our schools table shape.
export function parseSchoolRow(row) {
  if (!row || typeof row !== 'object') return null
  const urnRaw = row.URN ?? row.urn
  const urn = parseInt(urnRaw, 10)
  if (!Number.isFinite(urn) || urn <= 0) return null
  const name = (row.EstablishmentName || row.establishmentName || '').trim()
  if (!name) return null

  const phase = (row['PhaseOfEducation (name)'] || row.PhaseOfEducation || '').trim() || null
  const postcode = (row.Postcode || '').trim().toUpperCase() || null
  const ofsted_grade = (row['OfstedRating (name)'] || row.OfstedRating || '').trim() || null
  const inspRaw = (row.OfstedLastInsp || '').trim()
  let last_inspection_date = null
  if (inspRaw) {
    // GIAS uses DD-MM-YYYY
    const m = inspRaw.match(/^(\d{2})-(\d{2})-(\d{4})$/)
    if (m) last_inspection_date = `${m[3]}-${m[2]}-${m[1]}`
    else if (/^\d{4}-\d{2}-\d{2}/.test(inspRaw)) last_inspection_date = inspRaw.slice(0, 10)
  }
  const local_authority = (row['LA (name)'] || row.LA || '').trim() || null

  return {
    urn,
    name,
    phase,
    postcode,
    ofsted_grade,
    last_inspection_date,
    local_authority,
  }
}

export async function ingestSchoolsFromCsvUrl(url) {
  const target = url || SCHOOLS_CSV_URL
  logger.info({ url: target }, 'schools: ingest start')

  let imported = 0
  let skipped = 0
  let batch = []

  return new Promise((resolve, reject) => {
    axios({ method: 'get', url: target, responseType: 'stream' })
      .then((response) => {
        response.data
          .pipe(csv())
          .on('data', async (row) => {
            const parsed = parseSchoolRow(row)
            if (!parsed) {
              skipped++
              return
            }
            batch.push(parsed)
            if (batch.length >= BATCH_SIZE) {
              const current = batch
              batch = []
              try {
                const { error } = await db.from('schools').upsert(current, { onConflict: 'urn' })
                if (error) {
                  logger.error({ err: error.message }, 'schools: batch upsert failed')
                } else {
                  imported += current.length
                }
              } catch (err) {
                logger.error({ err: err.message }, 'schools: batch threw')
              }
            }
          })
          .on('end', async () => {
            if (batch.length > 0) {
              try {
                await db.from('schools').upsert(batch, { onConflict: 'urn' })
                imported += batch.length
              } catch (err) {
                logger.error({ err: err.message }, 'schools: final batch threw')
              }
            }
            logger.info({ imported, skipped }, 'schools: ingest complete')
            resolve({ imported, skipped })
          })
          .on('error', reject)
      })
      .catch(reject)
  })
}

// Stub — kept for future. GIAS does not provide a free public REST API; this
// function exists only to log a clear warning so callers don't silently expect
// data they can't get.
export async function ingestSchoolsFromGovApi() {
  logger.warn(
    'schools: GIAS has no public REST API — use ingestSchoolsFromCsvUrl with the monthly edubasealldata.csv URL from https://get-information-schools.service.gov.uk/Downloads'
  )
  return { imported: 0, skipped: 0, note: 'no public API; use CSV ingest' }
}

// Geocode schools with null lat/lng using their postcode (mirrors geocodeNurseriesBatch).
export async function geocodeSchoolsBatch(limit = 500) {
  const { data: schools, error } = await db
    .from('schools')
    .select('id, postcode')
    .is('lat', null)
    .not('postcode', 'is', null)
    .limit(limit)
  if (error) throw error
  if (!schools?.length) {
    logger.info('schools: nothing to geocode')
    return { geocoded: 0, failed: 0 }
  }
  let geocoded = 0
  let failed = 0
  for (const s of schools) {
    try {
      const { lat, lng } = await geocodePostcode(s.postcode)
      const { error: upErr } = await db.from('schools').update({ lat, lng }).eq('id', s.id)
      if (upErr) throw upErr
      geocoded++
    } catch (err) {
      logger.warn({ id: s.id, err: err.message }, 'schools: geocode failed')
      failed++
    }
  }
  return { geocoded, failed }
}
