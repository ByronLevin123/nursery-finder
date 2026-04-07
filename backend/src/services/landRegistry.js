// Land Registry Price Paid Data ingestion
// CRITICAL: Files are 4GB+ — stream only, never load into memory

import axios from 'axios'
import csv from 'csv-parser'
import db from '../db.js'
import { logger } from '../logger.js'

const BATCH_SIZE = 1000
const BASE_URL = 'https://price-paid-data.publicdata.landregistry.gov.uk'

export function extractDistrict(postcode) {
  if (!postcode) return null
  return postcode.trim().split(' ')[0].toUpperCase()
}

// Land Registry Price Paid CSV column order:
// 0 transaction_id, 1 price, 2 date_of_transfer, 3 postcode, 4 property_type,
// 5 new_build, 6 estate_type, 7 saon, 8 paon, 9 street, 10 locality,
// 11 town, 12 district, 13 county, 14 ppd_type, 15 record_status
const VALID_PROPERTY_TYPES = new Set(['D', 'S', 'T', 'F', 'O'])

export function parseLandRegistryRow(row) {
  if (!Array.isArray(row) || row.length < 6) return null
  const price = parseInt(row[1], 10)
  const date_of_transfer = row[2]
  const rawPostcode = row[3]
  const property_type = row[4]
  const newBuildFlag = row[5]

  if (!rawPostcode || !rawPostcode.trim()) return null
  if (!Number.isFinite(price) || price <= 0) return null
  if (!date_of_transfer) return null
  if (!VALID_PROPERTY_TYPES.has(property_type)) return null

  const postcode = rawPostcode.trim().toUpperCase()
  const postcode_district = extractDistrict(postcode)
  if (!postcode_district) return null

  return {
    postcode,
    postcode_district,
    price,
    date_of_transfer,
    property_type,
    new_build: newBuildFlag === 'Y',
  }
}

export async function ingestLandRegistryYear(year) {
  const url = `${BASE_URL}/pp-${year}.csv`
  logger.info({ url, year }, 'land_registry: starting ingestion')

  const cutoffDate = new Date()
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 3)

  let imported = 0
  let skipped = 0
  let batch = []

  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url,
      responseType: 'stream',
    })
      .then((response) => {
        response.data
          .pipe(
            csv({
              headers: [
                'transaction_id',
                'price',
                'date_of_transfer',
                'postcode',
                'property_type',
                'new_build',
                'estate_type',
                'saon',
                'paon',
                'street',
                'locality',
                'town',
                'district',
                'county',
                'ppd_type',
                'record_status',
              ],
              skipLines: 0,
            })
          )
          .on('data', async (row) => {
            const transferDate = new Date(row.date_of_transfer)
            if (transferDate < cutoffDate) {
              skipped++
              return
            }

            const district = extractDistrict(row.postcode)
            if (!district) {
              skipped++
              return
            }

            batch.push({
              postcode: row.postcode?.trim().toUpperCase(),
              postcode_district: district,
              price: parseInt(row.price),
              date_of_transfer: row.date_of_transfer,
              property_type: row.property_type,
              new_build: row.new_build === 'Y',
            })

            if (batch.length >= BATCH_SIZE) {
              const currentBatch = [...batch]
              batch = []
              try {
                const { error } = await db.from('land_registry_prices').upsert(currentBatch, {
                  onConflict: 'postcode,date_of_transfer,price,property_type',
                  ignoreDuplicates: true,
                })
                if (error) {
                  logger.error({ err: error.message }, 'land_registry: batch insert failed')
                } else {
                  imported += currentBatch.length
                  if (imported % 50000 === 0) {
                    logger.info({ imported, skipped, year }, 'land_registry: progress')
                  }
                }
              } catch (err) {
                logger.error({ err: err.message }, 'land_registry: batch threw')
              }
            }
          })
          .on('end', async () => {
            if (batch.length > 0) {
              await db.from('land_registry_prices').upsert(batch, { ignoreDuplicates: true })
              imported += batch.length
            }
            logger.info({ imported, skipped, year }, 'land_registry: year complete')
            resolve({ imported, skipped, year })
          })
          .on('error', reject)
      })
      .catch(reject)
  })
}

export async function refreshPropertyStats() {
  logger.info('land_registry: refreshing area property stats')
  const { data, error } = await db.rpc('compute_area_property_stats')
  if (error) throw error
  logger.info('land_registry: property stats refreshed')
}
