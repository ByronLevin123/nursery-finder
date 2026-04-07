// AI-generated short factual summary for a nursery profile page.
// Cached for 30 days. Includes area context where available.

import db from '../db.js'
import { callClaude } from './claudeApi.js'
import { getCached, setCached } from './aiCache.js'
import { logger } from '../logger.js'

const SYSTEM_PROMPT =
  'You write short, factual nursery summaries for UK parents. 2-3 sentences max. ' +
  'Mention the Ofsted grade, places, notable features, and one sentence about the area. ' +
  'Do not invent facts. If data is missing, omit it rather than speculate.'

function postcodeDistrict(pc) {
  if (!pc) return null
  return pc.trim().toUpperCase().split(' ')[0] || null
}

export async function getNurserySummary(urn) {
  const cacheKey = `nursery_summary:${urn}`
  const cached = await getCached(cacheKey)
  if (cached) return cached.content

  if (!db) return null
  const { data: nursery, error } = await db
    .from('nurseries')
    .select(
      'urn, name, town, postcode, local_authority, region, ofsted_overall_grade, last_inspection_date, total_places, places_funded_2yr, places_funded_3_4yr, provider_type, enforcement_notice'
    )
    .eq('urn', urn)
    .maybeSingle()
  if (error || !nursery) return null

  let area = null
  const district = postcodeDistrict(nursery.postcode)
  if (district) {
    const { data: areaRow } = await db
      .from('area_aggregations')
      .select('family_score, crime_rate_per_1000, imd_decile, nursery_outstanding_pct')
      .eq('postcode_district', district)
      .maybeSingle()
    area = areaRow || null
  }

  const facts = {
    nursery: {
      name: nursery.name,
      town: nursery.town,
      local_authority: nursery.local_authority,
      provider_type: nursery.provider_type,
      ofsted_grade: nursery.ofsted_overall_grade,
      last_inspection: nursery.last_inspection_date,
      total_places: nursery.total_places,
      funded_2yr_places: nursery.places_funded_2yr,
      funded_3_4yr_places: nursery.places_funded_3_4yr,
      enforcement_notice: nursery.enforcement_notice,
    },
    area,
  }

  const prompt =
    'Write a 2-3 sentence summary for parents based ONLY on these facts. ' +
    'Do not invent anything. JSON facts:\n' +
    JSON.stringify(facts)

  const text = await callClaude({ prompt, system: SYSTEM_PROMPT, maxTokens: 300 })
  const trimmed = (text || '').trim()
  if (!trimmed) return null

  await setCached(cacheKey, trimmed, {
    ttlDays: 30,
    metadata: { model: 'claude-haiku-4-5', urn },
  })
  logger.info({ urn }, 'ai nursery summary generated')
  return trimmed
}
