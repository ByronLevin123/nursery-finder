// Land Registry Price Paid Data ingestion
// CRITICAL: Files are 4GB+ — stream only, never load into memory

import axios from 'axios'
import csv from 'csv-parser'
import db from '../db.js'
import { logger } from '../logger.js'

const BATCH_SIZE = 1000
const BASE_URL = 'http://prod.publicdata.landregistry.gov.uk'

function extractDistrict(postcode) {
  if (!postcode) return null
  return postcode.trim().split(' ')[0].toUpperCase()
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
    }).then(response => {
      response.data
        .pipe(csv({
          headers: [
            'transaction_id', 'price', 'date_of_transfer', 'postcode',
            'property_type', 'new_build', 'estate_type', 'saon', 'paon',
            'street', 'locality', 'town', 'district', 'county',
            'ppd_type', 'record_status'
          ],
          skipLines: 0,
        }))
        .on('data', async row => {
          const transferDate = new Date(row.date_of_transfer)
          if (transferDate < cutoffDate) { skipped++; return }

          const district = extractDistrict(row.postcode)
          if (!district) { skipped++; return }

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
              await db.from('land_registry_prices').upsert(currentBatch, {
                onConflict: 'postcode,date_of_transfer,price',
                ignoreDuplicates: true,
              })
              imported += currentBatch.length
              if (imported % 10000 === 0) {
                logger.info({ imported, skipped }, 'land_registry: progress')
              }
            } catch (err) {
              logger.error({ err: err.message }, 'land_registry: batch insert failed')
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
    }).catch(reject)
  })
}

export async function refreshPropertyStats() {
  logger.info('land_registry: refreshing area property stats')
  const { data, error } = await db.rpc('compute_area_property_stats')
  if (error) throw error
  logger.info('land_registry: property stats refreshed')
}
