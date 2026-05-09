// Ofsted Early Years Register ingestion
// Uses the GOV.UK management information CSV — column names updated Jan 2025

import axios from 'axios'
import * as cheerio from 'cheerio'
import csv from 'csv-parser'
import { Readable } from 'stream'
import db from '../db.js'
import { logger } from '../logger.js'

const OFSTED_STATS_PAGE =
  'https://www.gov.uk/government/statistical-data-sets/childcare-providers-and-inspections-management-information'

const BATCH_SIZE = 200

function parseOfstedDate(str) {
  if (!str?.trim()) return null
  const [d, m, y] = str.trim().split('/')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// Numeric grades in CSV: 1=Outstanding, 2=Good, 3=RI, 4=Inadequate
const GRADE_MAP = {
  1: 'Outstanding',
  2: 'Good',
  3: 'Requires Improvement',
  4: 'Inadequate',
}

async function findCurrentCsvUrl() {
  logger.info('ofsted: fetching stats page to find current CSV URL')
  const { data: html } = await axios.get(OFSTED_STATS_PAGE, {
    headers: { 'User-Agent': 'NurseryMatch/1.0 (data@nurserymatch.com)' },
  })
  const $ = cheerio.load(html)

  let csvUrl = null
  $('a[href*=".csv"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href && href.toLowerCase().includes('most_recent') && !csvUrl) {
      csvUrl = href.startsWith('http') ? href : `https://www.gov.uk${href}`
    }
  })

  if (!csvUrl) {
    throw new Error(
      'Could not find most-recent inspections CSV on GOV.UK page. Check the page manually.'
    )
  }

  logger.info({ csvUrl }, 'ofsted: found CSV URL')
  return csvUrl
}

function mapRow(row) {
  const gradeRaw = row['Most Recent Full: Overall Effectiveness']?.trim()
  const grade = GRADE_MAP[gradeRaw] || null

  // Skip childminders with REDACTED addresses — we can't geocode them
  const address = row['Provider Address Line 1']?.trim()
  if (address === 'REDACTED' || !address) return null

  return {
    urn: row['Provider URN']?.trim(),
    name: row['Provider Name']?.trim(),
    provider_type: row['Provider Type']?.trim(),
    registration_status: row['Provider Status']?.trim(),
    address_line1: address || null,
    address_line2: row['Provider Address Line 2']?.trim() || null,
    town: row['Provider Town']?.trim() || null,
    postcode: row['Provider Postcode']?.trim().toUpperCase() || null,
    local_authority: row['Local Authority']?.trim() || null,
    region: row['Region']?.trim() || null,
    phone: null,
    email: null,
    ofsted_overall_grade: grade,
    last_inspection_date: parseOfstedDate(row['Most Recent Full: Inspection Date']),
    inspection_report_url: null,
    enforcement_notice: false,
    total_places: parseInt(row['Places']) || null,
    places_funded_2yr: null,
    places_funded_3_4yr: null,
  }
}

export async function ingestOfstedRegister() {
  const startTime = Date.now()
  let imported = 0
  let skipped = 0
  let errors = 0

  const csvUrl = await findCurrentCsvUrl()

  logger.info({ csvUrl }, 'ofsted: downloading CSV')
  const response = await axios.get(csvUrl, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'NurseryMatch/1.0 (data@nurserymatch.com)' },
  })

  // CSV has 2 info rows before the header row — skip them
  const rawCsv = Buffer.from(response.data).toString('utf-8')
  const lines = rawCsv.split('\n')
  const csvWithoutPreamble = lines.slice(2).join('\n')

  const records = []
  await new Promise((resolve, reject) => {
    Readable.from(csvWithoutPreamble)
      .pipe(csv())
      .on('data', (row) => {
        if (row['Provider Status']?.trim() === 'Active') {
          const mapped = mapRow(row)
          if (mapped?.urn) records.push(mapped)
        } else {
          skipped++
        }
      })
      .on('end', resolve)
      .on('error', reject)
  })

  logger.info({ total: records.length, skipped }, 'ofsted: CSV parsed, starting upsert')

  let gradeChanges = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    // Detect grade changes before upserting
    try {
      const urns = batch.map((r) => r.urn).filter(Boolean)
      if (urns.length > 0) {
        const { data: existing } = await db
          .from('nurseries')
          .select('urn, ofsted_overall_grade')
          .in('urn', urns)

        if (existing && existing.length > 0) {
          const existingByUrn = new Map(existing.map((n) => [n.urn, n.ofsted_overall_grade]))
          const changes = []

          for (const record of batch) {
            if (!record.urn || !record.ofsted_overall_grade) continue
            const previousGrade = existingByUrn.get(record.urn)
            if (previousGrade && previousGrade !== record.ofsted_overall_grade) {
              changes.push({
                nursery_urn: record.urn,
                previous_grade: previousGrade,
                new_grade: record.ofsted_overall_grade,
              })
              logger.info(
                { urn: record.urn, name: record.name, previousGrade, newGrade: record.ofsted_overall_grade },
                'ofsted: grade change detected'
              )
            }
          }

          if (changes.length > 0) {
            const { error: changeErr } = await db.from('ofsted_changes').insert(changes)
            if (changeErr) {
              logger.error({ error: changeErr.message }, 'ofsted: failed to insert grade changes')
            } else {
              gradeChanges += changes.length
            }
          }
        }
      }
    } catch (detectErr) {
      logger.warn({ err: detectErr?.message, batchStart: i }, 'ofsted: grade change detection failed, continuing with upsert')
    }

    const { error } = await db.from('nurseries').upsert(batch, {
      onConflict: 'urn',
      ignoreDuplicates: false,
    })

    if (error) {
      logger.error({ error: error.message, batchStart: i }, 'ofsted: batch upsert failed')
      errors += batch.length
    } else {
      imported += batch.length
    }

    if (i % 2000 === 0) {
      logger.info({ imported, remaining: records.length - i }, 'ofsted: progress')
    }
  }

  const duration = Date.now() - startTime
  logger.info({ imported, skipped, errors, gradeChanges, duration_ms: duration }, 'ofsted: ingest complete')
  return { imported, skipped, errors, gradeChanges, duration_ms: duration }
}
