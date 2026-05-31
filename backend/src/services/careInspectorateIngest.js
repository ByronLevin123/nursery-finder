// Care Inspectorate (Scotland) childcare data ingestion
// Data source: https://www.careinspectorate.com/index.php/statistics-and-analysis/data-and-analysis
// Format: CSV download (monthly updates)
// License: Open Government Licence

import axios from 'axios'
import csv from 'csv-parser'
import { Readable } from 'stream'
import db from '../db.js'
import { logger } from '../logger.js'

const BATCH_SIZE = 200

// Care Inspectorate uses 1-6 scale (6 = best)
// Map to quality_tier for cross-country search
function mapGradeToQualityTier(grade) {
  const num = parseInt(grade, 10)
  if (!Number.isFinite(num)) return null
  if (num >= 1 && num <= 6) return num
  return null
}

function gradeLabel(grade) {
  const labels = {
    6: 'Excellent',
    5: 'Very Good',
    4: 'Good',
    3: 'Adequate',
    2: 'Weak',
    1: 'Unsatisfactory',
  }
  return labels[parseInt(grade, 10)] || null
}

function parseDate(str) {
  if (!str?.trim()) return null
  // Try DD/MM/YYYY
  const dmy = str.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str.trim())) return str.trim().slice(0, 10)
  return null
}

function mapRow(row) {
  // Care Inspectorate CSV column names (may vary — handle common variants)
  const regNumber = (
    row['CareService'] ||
    row['CS Number'] ||
    row['Registration Number'] ||
    row['ServiceNumber'] ||
    row['Service Number'] ||
    ''
  ).trim()
  const name = (row['ServiceName'] || row['Service Name'] || row['Service_Name'] || '').trim()

  if (!regNumber || !name) return null

  const serviceType = (
    row['ServiceType'] ||
    row['Service Type'] ||
    row['Service_Type'] ||
    ''
  ).trim()

  // Only include childcare-related services
  const childcareTypes = [
    'Day Care of Children',
    'Childminding',
    'Child Care Agency',
    'daycare',
    'childminding',
    'child care',
  ]
  const isChildcare = childcareTypes.some((t) =>
    serviceType.toLowerCase().includes(t.toLowerCase())
  )
  if (!isChildcare && serviceType) return null

  const overallGrade = (
    row['Grades'] ||
    row['Overall Grade'] ||
    row['Quality of care and support'] ||
    row['GradeQualityCareSupport'] ||
    ''
  ).trim()

  const postcode = (row['Postcode'] || row['ServicePostcode'] || '').trim().toUpperCase() || null
  if (!postcode) return null

  const address = (row['Address'] || row['ServiceAddress'] || '').trim() || null
  const town = (row['Town'] || row['Council'] || '').trim() || null
  const localAuthority = (row['Council'] || row['CouncilAreaName'] || '').trim() || null

  const lastInspection = parseDate(
    row['Last Inspection Date'] || row['DateOfLatestInspection'] || row['Publication date'] || ''
  )

  const places = parseInt(row['Places'] || row['Registered Places'] || row['MaxPlaces'] || '', 10)

  const providerType = serviceType.toLowerCase().includes('childminding')
    ? 'Childminder'
    : 'Childcare on non-domestic premises'

  return {
    urn: `CS${regNumber}`,
    name,
    provider_type: providerType,
    registration_status: 'Active',
    address_line1: address === 'REDACTED' ? null : address,
    town,
    postcode,
    local_authority: localAuthority,
    region: 'Scotland',
    country: 'Scotland',
    inspection_body: 'Care Inspectorate',
    care_inspectorate_grade: gradeLabel(overallGrade) || overallGrade || null,
    quality_tier: mapGradeToQualityTier(overallGrade),
    ofsted_overall_grade: null,
    last_inspection_date: lastInspection,
    total_places: Number.isFinite(places) ? places : null,
    enforcement_notice: false,
    phone: null,
    email: null,
  }
}

export async function ingestCareInspectorateData(csvUrl) {
  if (!csvUrl) {
    throw new Error(
      'CSV URL required. Download the latest childcare services CSV from ' +
        'https://www.careinspectorate.com/index.php/statistics-and-analysis/data-and-analysis'
    )
  }

  const startTime = Date.now()
  let imported = 0
  let skipped = 0
  let errors = 0

  logger.info({ csvUrl }, 'care-inspectorate: downloading CSV')
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

  logger.info({ total: records.length, skipped }, 'care-inspectorate: CSV parsed, starting upsert')

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { error } = await db.from('nurseries').upsert(batch, {
      onConflict: 'urn',
      ignoreDuplicates: false,
    })

    if (error) {
      logger.error(
        { error: error.message, batchStart: i },
        'care-inspectorate: batch upsert failed'
      )
      errors += batch.length
    } else {
      imported += batch.length
    }

    if (i % 1000 === 0 && i > 0) {
      logger.info({ imported, remaining: records.length - i }, 'care-inspectorate: progress')
    }
  }

  const duration = Date.now() - startTime
  logger.info(
    { imported, skipped, errors, duration_ms: duration },
    'care-inspectorate: ingest complete'
  )
  return { imported, skipped, errors, duration_ms: duration, country: 'Scotland' }
}
