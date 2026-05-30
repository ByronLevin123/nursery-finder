// Care Inspectorate Wales (CIW) childcare data ingestion
// Data source: https://careinspectorate.wales/service-directory
// Format: CSV download
// License: Open Government Licence (Wales)
//
// CIW uses ratings: Excellent, Good, Adequate, Poor
// These map closely to Ofsted grades.

import axios from 'axios'
import csv from 'csv-parser'
import { Readable } from 'stream'
import db from '../db.js'
import { logger } from '../logger.js'

const BATCH_SIZE = 200

const CIW_GRADE_MAP = {
  Excellent: 6,
  Good: 4,
  Adequate: 3,
  Poor: 1,
}

function parseDate(str) {
  if (!str?.trim()) return null
  const dmy = str.trim().match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}/.test(str.trim())) return str.trim().slice(0, 10)
  return null
}

function mapRow(row) {
  const regNumber = (
    row['Registration Number'] || row['Service Reference'] ||
    row['CIW Number'] || row['ServiceRef'] || ''
  ).trim()
  const name = (
    row['Service Name'] || row['ServiceName'] || row['Name'] || ''
  ).trim()

  if (!regNumber || !name) return null

  const serviceType = (
    row['Service Type'] || row['ServiceType'] || row['Type'] || ''
  ).trim()

  // Filter for childcare services
  const childcareTypes = [
    'Day Care', 'Child Minding', 'Childminding', 'Full Day Care',
    'Sessional Day Care', 'Out of School Care', 'Open Access Play',
    'Creche', 'Nursery',
  ]
  const isChildcare = childcareTypes.some((t) =>
    serviceType.toLowerCase().includes(t.toLowerCase())
  ) || serviceType === ''

  if (!isChildcare) return null

  const overallGrade = (
    row['Overall Grade'] || row['Overall Assessment'] ||
    row['Rating'] || row['OverallJudgement'] || ''
  ).trim()

  const postcode = (row['Postcode'] || row['Post Code'] || '').trim().toUpperCase() || null
  if (!postcode) return null

  const address = (row['Address'] || row['ServiceAddress'] || '').trim() || null
  const town = (row['Town'] || row['City'] || row['Location'] || '').trim() || null
  const localAuthority = (
    row['Local Authority'] || row['LA'] || row['Council'] || ''
  ).trim() || null

  const lastInspection = parseDate(
    row['Last Inspection Date'] || row['Date of Last Inspection'] || ''
  )

  const places = parseInt(row['Places'] || row['Registered Places'] || '', 10)

  const providerType = serviceType.toLowerCase().includes('child minding') ||
    serviceType.toLowerCase().includes('childminding')
    ? 'Childminder'
    : 'Childcare on non-domestic premises'

  return {
    urn: `CIW${regNumber}`,
    name,
    provider_type: providerType,
    registration_status: 'Active',
    address_line1: address === 'REDACTED' ? null : address,
    town,
    postcode,
    local_authority: localAuthority,
    region: 'Wales',
    country: 'Wales',
    inspection_body: 'CIW',
    ciw_grade: overallGrade || null,
    quality_tier: CIW_GRADE_MAP[overallGrade] || null,
    ofsted_overall_grade: null,
    last_inspection_date: lastInspection,
    total_places: Number.isFinite(places) ? places : null,
    enforcement_notice: false,
    phone: null,
    email: null,
  }
}

export async function ingestCiwData(csvUrl) {
  if (!csvUrl) {
    throw new Error(
      'CSV URL required. Download the latest childcare services CSV from ' +
      'https://careinspectorate.wales/service-directory'
    )
  }

  const startTime = Date.now()
  let imported = 0
  let skipped = 0
  let errors = 0

  logger.info({ csvUrl }, 'ciw: downloading CSV')
  const response = await axios.get(csvUrl, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'NurseryMatch/1.0 (data@nurserymatch.com)' },
    timeout: 120000,
  })

  const rawCsv = Buffer.from(response.data).toString('utf-8')
  const records = []

  await new Promise((resolve, reject) => {
    Readable.from(rawCsv)
      .pipe(csv())
      .on('data', (row) => {
        const mapped = mapRow(row)
        if (mapped) {
          records.push(mapped)
        } else {
          skipped++
        }
      })
      .on('end', resolve)
      .on('error', reject)
  })

  logger.info({ total: records.length, skipped }, 'ciw: CSV parsed, starting upsert')

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { error } = await db.from('nurseries').upsert(batch, {
      onConflict: 'urn',
      ignoreDuplicates: false,
    })

    if (error) {
      logger.error({ error: error.message, batchStart: i }, 'ciw: batch upsert failed')
      errors += batch.length
    } else {
      imported += batch.length
    }
  }

  const duration = Date.now() - startTime
  logger.info({ imported, skipped, errors, duration_ms: duration }, 'ciw: ingest complete')
  return { imported, skipped, errors, duration_ms: duration, country: 'Wales' }
}
