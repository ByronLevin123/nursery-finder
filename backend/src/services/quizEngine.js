// Quiz-to-nursery matching engine — maps quiz responses to scoring weights,
// computes personalised fit scores, and generates trade-off explanations.

import crypto from 'crypto'
import db from '../db.js'
import { geocodePostcode } from './geocoding.js'
import { getCached, setCached } from './aiCache.js'
import { callClaude, isClaudeAvailable } from './claudeApi.js'
import { logger } from '../logger.js'

const DIMENSION_MAP = {
  quality: 'quality_score',
  cost: 'cost_score',
  location: 'commute',
  staff: 'staff_score',
  availability: 'availability_score',
  facilities: 'sentiment_score',
}

const ALL_DIMENSIONS = ['quality', 'cost', 'availability', 'staff', 'sentiment', 'commute']

/**
 * Pure function: maps quiz answers to a weight object.
 * Each dimension gets a weight 1-5 based on priority_order ranking.
 */
export function mapQuizToWeights(quiz) {
  const weights = {
    quality: 1,
    cost: 1,
    availability: 1,
    staff: 1,
    sentiment: 1,
    commute: 1,
  }

  // priority_order[0] gets weight 5, [1] gets 4, etc.
  if (Array.isArray(quiz.priority_order)) {
    quiz.priority_order.forEach((dim, idx) => {
      const mapped = DIMENSION_MAP[dim]
      // mapped could be a nursery column name or 'commute'
      const key = mapped === 'commute' ? 'commute' : mapped?.replace('_score', '')
      if (key && Object.prototype.hasOwnProperty.call(weights, key)) {
        weights[key] = Math.max(1, 5 - idx)
      }
    })
  }

  // Urgency boosts availability weight
  if (quiz.urgency === 'asap') {
    weights.availability = Math.min(5, weights.availability + 2)
  } else if (quiz.urgency === '3_months') {
    weights.availability = Math.min(5, weights.availability + 1)
  }

  return {
    weights,
    budget_min: quiz.budget_min || null,
    budget_max: quiz.budget_max || null,
    min_grade: quiz.min_grade || null,
    must_haves: Array.isArray(quiz.must_haves) ? quiz.must_haves : [],
  }
}

/**
 * Pure function: compute a 0-100 fit score for a nursery given weights.
 * Skips null dimensions.
 */
export function calculateFitScore(nursery, weights) {
  let weightedSum = 0
  let totalWeight = 0

  for (const dim of ALL_DIMENSIONS) {
    const scoreKey = dim === 'commute' ? 'commute_score' : `${dim}_score`
    const score = nursery[scoreKey]
    const weight = weights[dim] || 1

    if (score == null) continue

    weightedSum += score * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return null
  return Math.round(weightedSum / totalWeight)
}

/**
 * Loads nurseries near the user's commute postcode(s), computes fit score,
 * and returns top N sorted by fit_score descending.
 */
export async function getPersonalisedRankings(quiz, options = {}) {
  const { limit = 20, offset = 0 } = options
  const parsed = mapQuizToWeights(quiz)

  // Resolve postcodes to geocode
  const postcodes = []
  if (quiz.commute_postcode) {
    postcodes.push(quiz.commute_postcode)
  }

  // If commute_from is 'both' and we have user profile postcodes
  if (quiz.commute_from === 'both' && quiz.home_postcode && quiz.work_postcode) {
    postcodes.length = 0
    postcodes.push(quiz.home_postcode, quiz.work_postcode)
  }

  if (postcodes.length === 0) {
    return { data: [], meta: { total: 0, limit, offset } }
  }

  // Search from each postcode, merge and deduplicate
  const allNurseries = new Map()

  for (const pc of postcodes) {
    try {
      const { lat, lng } = await geocodePostcode(pc)

      const { data, error } = await db.rpc('search_nurseries_near', {
        search_lat: lat,
        search_lng: lng,
        radius_km: 10,
        grade_filter: null,
        funded_2yr: false,
        funded_3yr: false,
      })

      if (error) {
        logger.warn({ error: error.message, postcode: pc }, 'quiz search failed')
        continue
      }

      for (const n of data || []) {
        // Compute commute_score based on distance (closer = higher score)
        const commute_score =
          n.distance_km != null ? Math.max(0, Math.round(100 - n.distance_km * 10)) : null

        const enriched = { ...n, commute_score }

        // Keep best scoring version of each nursery
        const existing = allNurseries.get(n.urn)
        if (!existing) {
          allNurseries.set(n.urn, enriched)
        } else {
          const existingFit = calculateFitScore(existing, parsed.weights)
          const newFit = calculateFitScore(enriched, parsed.weights)
          if ((newFit || 0) > (existingFit || 0)) {
            allNurseries.set(n.urn, enriched)
          }
        }
      }
    } catch (err) {
      logger.warn({ err: err.message, postcode: pc }, 'geocode failed for quiz postcode')
    }
  }

  let nurseries = [...allNurseries.values()]

  // Hard filters
  if (parsed.min_grade) {
    const gradeOrder = { Outstanding: 1, Good: 2, 'Requires improvement': 3, Inadequate: 4 }
    const minRank = gradeOrder[parsed.min_grade] || 4
    nurseries = nurseries.filter((n) => {
      if (!n.ofsted_overall_grade) return false
      return (gradeOrder[n.ofsted_overall_grade] || 4) <= minRank
    })
  }

  if (parsed.budget_max) {
    nurseries = nurseries.filter(
      (n) => !n.fee_avg_monthly || n.fee_avg_monthly <= parsed.budget_max
    )
  }

  // Score and sort
  const scored = nurseries
    .map((n) => ({
      ...n,
      fit_score: calculateFitScore(n, parsed.weights),
      dimension_breakdown: buildBreakdown(n, parsed.weights),
    }))
    .filter((n) => n.fit_score != null)
    .sort((a, b) => b.fit_score - a.fit_score)

  const total = scored.length
  const paginated = scored.slice(offset, offset + limit)

  return {
    data: paginated,
    meta: { total, limit, offset },
  }
}

function buildBreakdown(nursery, weights) {
  const breakdown = {}
  for (const dim of ALL_DIMENSIONS) {
    const scoreKey = dim === 'commute' ? 'commute_score' : `${dim}_score`
    breakdown[dim] = {
      score: nursery[scoreKey] ?? null,
      weight: weights[dim] || 1,
    }
  }
  return breakdown
}

/**
 * Calls Claude Haiku to produce a 2-sentence comparison explaining trade-offs.
 * Cached by sha1(urnA+urnB+weightsHash) for 7 days.
 */
export async function generateTradeoffExplanation(nurseryA, nurseryB, weights) {
  if (!isClaudeAvailable()) return null

  const weightsStr = JSON.stringify(weights)
  const hash = crypto
    .createHash('sha1')
    .update(`${nurseryA.urn}+${nurseryB.urn}+${weightsStr}`)
    .digest('hex')
  const cacheKey = `tradeoff:${hash}`

  const cached = await getCached(cacheKey)
  if (cached) return cached.content

  const prompt = `Compare these two nurseries for a parent. Return exactly 2 sentences explaining the key trade-offs.

Nursery A: ${nurseryA.name} (${nurseryA.town})
- Ofsted: ${nurseryA.ofsted_overall_grade || 'N/A'}
- Quality score: ${nurseryA.quality_score ?? 'N/A'}/100
- Cost score: ${nurseryA.cost_score ?? 'N/A'}/100
- Availability: ${nurseryA.availability_score ?? 'N/A'}/100
- Staff: ${nurseryA.staff_score ?? 'N/A'}/100

Nursery B: ${nurseryB.name} (${nurseryB.town})
- Ofsted: ${nurseryB.ofsted_overall_grade || 'N/A'}
- Quality score: ${nurseryB.quality_score ?? 'N/A'}/100
- Cost score: ${nurseryB.cost_score ?? 'N/A'}/100
- Availability: ${nurseryB.availability_score ?? 'N/A'}/100
- Staff: ${nurseryB.staff_score ?? 'N/A'}/100

Parent's priorities (1-5 weights): quality=${weights.quality}, cost=${weights.cost}, availability=${weights.availability}, staff=${weights.staff}.`

  try {
    const text = await callClaude({
      prompt,
      system: 'You are a helpful nursery comparison assistant. Be concise and factual.',
      maxTokens: 200,
    })
    await setCached(cacheKey, text, { ttlDays: 7 })
    return text
  } catch (err) {
    logger.warn({ err: err.message }, 'tradeoff explanation failed')
    return null
  }
}
