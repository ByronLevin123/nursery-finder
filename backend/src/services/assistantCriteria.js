// Extract & merge structured "family move" criteria from a free-text user message.
// Uses Claude Haiku, low temperature, with aiCache for 1 hour.

import crypto from 'crypto'
import { callClaude } from './claudeApi.js'
import { getCached, setCached } from './aiCache.js'
import { logger } from '../logger.js'

const SYSTEM_PROMPT =
  'You extract structured family-relocation criteria from a user message for a UK nursery + property assistant. ' +
  'Merge the prior criteria with NEW information from the latest message. Keep prior values unless the user clearly changes them. ' +
  'Respond with valid JSON only, no prose, no markdown fences. Use null for unknown numeric fields and empty arrays for lists. ' +
  'Schema: {' +
  '"area": {"postcode": string|null, "district": string|null, "region": string|null, "max_distance_km": number|null}, ' +
  '"budget": {"type": "sale"|"rent"|null, "min": number|null, "max": number|null}, ' +
  '"bedrooms": {"min": number|null}, ' +
  '"priorities": {' +
  '"nursery_quality": "required"|"priority"|"nice"|null, ' +
  '"low_crime": "required"|"priority"|"nice"|null, ' +
  '"low_deprivation": "required"|"priority"|"nice"|null, ' +
  '"affordability": "required"|"priority"|"nice"|null' +
  '}, ' +
  '"notes": string[]' +
  '} ' +
  'Use "notes" for any user wishes you cannot score (e.g. "near a park", "good transport").'

export const EMPTY_CRITERIA = {
  area: { postcode: null, district: null, region: null, max_distance_km: null },
  budget: { type: null, min: null, max: null },
  bedrooms: { min: null },
  priorities: {
    nursery_quality: null,
    low_crime: null,
    low_deprivation: null,
    affordability: null,
  },
  notes: [],
}

function safeParseJson(text) {
  if (!text) return null
  const cleaned = text
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

// Pure: merge prior criteria with newly extracted criteria.
// New non-null values overwrite prior. Notes are unioned (deduped).
export function mergeCriteria(prior, extracted) {
  const base = prior || EMPTY_CRITERIA
  const ex = extracted || {}
  const pickNonNull = (a, b) => (b !== undefined && b !== null ? b : a)

  const area = {
    postcode: pickNonNull(base.area?.postcode ?? null, ex.area?.postcode),
    district: pickNonNull(base.area?.district ?? null, ex.area?.district),
    region: pickNonNull(base.area?.region ?? null, ex.area?.region),
    max_distance_km: pickNonNull(base.area?.max_distance_km ?? null, ex.area?.max_distance_km),
  }
  const budget = {
    type: pickNonNull(base.budget?.type ?? null, ex.budget?.type),
    min: pickNonNull(base.budget?.min ?? null, ex.budget?.min),
    max: pickNonNull(base.budget?.max ?? null, ex.budget?.max),
  }
  const bedrooms = {
    min: pickNonNull(base.bedrooms?.min ?? null, ex.bedrooms?.min),
  }
  const priorities = {
    nursery_quality: pickNonNull(
      base.priorities?.nursery_quality ?? null,
      ex.priorities?.nursery_quality
    ),
    low_crime: pickNonNull(base.priorities?.low_crime ?? null, ex.priorities?.low_crime),
    low_deprivation: pickNonNull(
      base.priorities?.low_deprivation ?? null,
      ex.priorities?.low_deprivation
    ),
    affordability: pickNonNull(
      base.priorities?.affordability ?? null,
      ex.priorities?.affordability
    ),
  }
  const priorNotes = Array.isArray(base.notes) ? base.notes : []
  const newNotes = Array.isArray(ex.notes) ? ex.notes : []
  const seen = new Set()
  const notes = []
  for (const n of [...priorNotes, ...newNotes]) {
    if (typeof n !== 'string') continue
    const t = n.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    notes.push(t)
  }
  return { area, budget, bedrooms, priorities, notes }
}

function hashKey(message, prior) {
  const h = crypto.createHash('sha1')
  h.update(message || '')
  h.update('|')
  h.update(JSON.stringify(prior || {}))
  return `assistant:extract:${h.digest('hex')}`
}

export async function extractDistrictCriteria(userMessage, priorCriteria) {
  if (typeof userMessage !== 'string' || !userMessage.trim()) {
    throw new Error('userMessage is required')
  }
  const prior = priorCriteria || EMPTY_CRITERIA
  const cacheKey = hashKey(userMessage.trim(), prior)

  const cached = await getCached(cacheKey)
  if (cached?.content) {
    try {
      const parsed = JSON.parse(cached.content)
      return mergeCriteria(prior, parsed)
    } catch {
      // fall through
    }
  }

  const prompt =
    'PRIOR CRITERIA:\n' + JSON.stringify(prior) + '\n\nLATEST USER MESSAGE:\n' + userMessage.trim()

  let text
  try {
    text = await callClaude({
      prompt,
      system: SYSTEM_PROMPT,
      maxTokens: 600,
    })
  } catch (err) {
    logger.warn({ err: err.message }, 'assistant criteria extract failed')
    throw err
  }

  const parsed = safeParseJson(text)
  if (!parsed || typeof parsed !== 'object') {
    logger.warn('assistant criteria: failed to parse JSON, returning prior')
    return prior
  }

  const merged = mergeCriteria(prior, parsed)
  // cache the *extracted* delta so subsequent merges still work
  await setCached(cacheKey, JSON.stringify(parsed), {
    ttlDays: 1 / 24, // ~1 hour
    metadata: { kind: 'assistant_extract' },
  })
  return merged
}

// Short confirmation reply — one short sentence summarising what was understood.
export async function generateAssistantReply(criteria) {
  const facts = {
    area: criteria.area,
    budget: criteria.budget,
    bedrooms: criteria.bedrooms,
    priorities: criteria.priorities,
    notes: criteria.notes,
  }
  const system =
    'You are a friendly UK family relocation assistant. Reply with ONE short sentence (max 25 words) ' +
    'confirming what you understood from the user. Plain text, no markdown, no lists.'
  const prompt =
    'Confirm understanding of these criteria in one sentence:\n' + JSON.stringify(facts)
  try {
    const text = await callClaude({ prompt, system, maxTokens: 120 })
    return (text || '').trim()
  } catch (err) {
    logger.warn({ err: err.message }, 'assistant reply failed')
    return 'Got it — updated your criteria.'
  }
}
