// Parse a free-text natural language query into structured search filters.
// Strict JSON output. Returns null fields where the user did not specify a value.

import { callClaude } from './claudeApi.js'
import { logger } from '../logger.js'

const SYSTEM_PROMPT =
  'You extract search filters from natural language queries for a UK nursery search engine. ' +
  'Respond with valid JSON only, no prose, no markdown fences. ' +
  'Use null for unspecified fields. Do not invent values. ' +
  'Schema: {' +
  '"postcode": string|null, ' + // e.g. "SW11" or "SW1A 1AA"
  '"grade": "Outstanding"|"Good"|"Requires improvement"|"Inadequate"|null, ' +
  '"funded_2yr": boolean|null, ' +
  '"funded_3yr": boolean|null, ' +
  '"radius_km": number|null, ' +
  '"maxCrimeRate": number|null, ' +
  '"minFamilyScore": number|null, ' +
  '"maxPrice": number|null, ' +
  '"keywords": string|null' +
  '}'

function safeParseJson(text) {
  if (!text) return null
  let cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

export async function parseNaturalLanguageSearch(query) {
  if (typeof query !== 'string' || !query.trim()) {
    throw new Error('query is required')
  }
  const text = await callClaude({
    prompt: `Query: ${query.trim()}`,
    system: SYSTEM_PROMPT,
    maxTokens: 300,
  })
  const parsed = safeParseJson(text)
  if (!parsed || typeof parsed !== 'object') {
    logger.warn('ai conversational search: failed to parse JSON, returning empty filters')
    return {
      postcode: null,
      grade: null,
      funded_2yr: null,
      funded_3yr: null,
      radius_km: null,
      maxCrimeRate: null,
      minFamilyScore: null,
      maxPrice: null,
      keywords: null,
    }
  }
  return parsed
}
