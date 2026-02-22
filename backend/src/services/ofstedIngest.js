// Ofsted Early Years Register ingestion
// The CSV filename changes monthly — we scrape the page to find the current link

import axios from 'axios'
import * as cheerio from 'cheerio'
import csv from 'csv-parser'
import { Readable } from 'stream'
import db from '../db.js'
import { logger } from '../logger.js'

const OFSTED_PAGE_URL =
  'https://www.gov.uk/government/statistical-data-sets/monthly-management-information-ofsteds-early-years-register'

const BATCH_SIZE = 200

function parseOfstedDate(str) {
  if (!str?.trim()) return null
  const [d, m, y] = str.trim().split('/')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

async function findCurrentCsvUrl() {
  logger.info('ofsted: fetching register page to find current CSV URL')
  const { data: html } = await axios.get(OFSTED_PAGE_URL, {
    headers: { 'User-Agent': 'NurseryFinder/1.0 (data@nurseryfinder.co.uk)' }
  })
  const $ = cheerio.load(html)

  let csvUrl = null
  $('a[href$=".csv"], a[href*=".csv"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href && href.toLowerCase().includes('early_year')) {
      if (!csvUrl) {
        csvUrl = href.startsWith('http') ? href : `https://www.gov.uk${href}`
      }
    }
  })

  if (!csvUrl) {
    throw new Error('Could not find Early Years Register CSV on GOV.UK page. Check the page manually.')
  }

  logger.info({ csvUrl }, 'ofsted: found CSV URL')
  return csvUrl
}

function mapRow(row) {
  const grade = row['Overall Effectiveness']?.trim() || null
  const validGrades = ['Outstanding', 'Good', 'Requires Improvement', 'Inadequate']

  return {
    urn: row['URN']?.trim(),
    name: row['Provider Name']?.trim(),
    provider_type: row['Provider Type']?.trim(),
    registration_status: row['Registration Status']?.trim(),
    address_line1: row['Address 1']?.trim() || null,
    address_line2: row['Address 2']?.trim() || null,
    town: row['Town']?.trim() || null,
    postcode: row['Postcode']?.trim().toUpperCase() || null,
    local_authority: row['Local Authority']?.trim() || null,
    region: row['Region']?.trim() || null,
    phone: row['Telephone Number']?.trim() || null,
    email: row['Email Address']?.trim() || null,
    ofsted_overall_grade: validGrades.includes(grade) ? grade : null,
    last_inspection_date: parseOfstedDate(row['Inspection Date']),
    inspection_report_url: row['Web Link']?.trim() || null,
    enforcement_notice: !!(row['Action']?.trim()),
    total_places: parseInt(row['Registered places']) || null,
    places_funded_2yr: parseInt(row['Places Funded 2yr']) || null,
    places_funded_3_4yr: parseInt(row['Places Funded 3 or 4yr']) || null,
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
    headers: { 'User-Agent': 'NurseryFinder/1.0 (data@nurseryfinder.co.uk)' }
  })

  const records = []
  await new Promise((resolve, reject) => {
    Readable.from(Buffer.from(response.data).toString('utf-8'))
      .pipe(csv())
      .on('data', row => {
        if (row['Registration Status']?.trim() === 'Active') {
          const mapped = mapRow(row)
          if (mapped.urn) records.push(mapped)
        } else {
          skipped++
        }
      })
      .on('end', resolve)
      .on('error', reject)
  })

  logger.info({ total: records.length, skipped }, 'ofsted: CSV parsed, starting upsert')

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { error } = await db
      .from('nurseries')
      .upsert(batch, {
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
  logger.info({ imported, skipped, errors, duration_ms: duration }, 'ofsted: ingest complete')
  return { imported, skipped, errors, duration_ms: duration }
}
