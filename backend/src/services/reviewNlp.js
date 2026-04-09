// Review NLP — extracts category scores from review text using Claude Haiku.

import crypto from 'crypto'
import { callClaude, isClaudeAvailable } from './claudeApi.js'
import { getCached, setCached } from './aiCache.js'
import { logger } from '../logger.js'

const CATEGORIES = ['staff', 'food', 'communication', 'facilities', 'learning', 'safety']

/**
 * Extracts category scores from a review text using Claude Haiku.
 * Returns { staff: 4, food: 3, ... } or null on failure.
 */
export async function extractCategoryScores(reviewText) {
  if (!isClaudeAvailable()) return null
  if (!reviewText || typeof reviewText !== 'string' || reviewText.length < 10) return null

  const hash = crypto.createHash('sha1').update(reviewText).digest('hex')
  const cacheKey = `review-nlp:${hash}`

  const cached = await getCached(cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached.content)
    } catch {
      // stale cache, regenerate
    }
  }

  const prompt = `Rate this nursery review on 6 categories (staff, food, communication, facilities, learning, safety) from 1-5. Return JSON only, no explanation.

Review: "${reviewText}"`

  try {
    const text = await callClaude({
      prompt,
      system: 'You are a review analysis tool. Return only valid JSON with keys: staff, food, communication, facilities, learning, safety. Each value is an integer 1-5.',
      maxTokens: 100,
    })

    // Parse the JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      logger.warn('reviewNlp: no JSON found in Claude response')
      return null
    }

    const scores = JSON.parse(jsonMatch[0])

    // Validate all categories present and 1-5
    for (const cat of CATEGORIES) {
      if (typeof scores[cat] !== 'number' || scores[cat] < 1 || scores[cat] > 5) {
        logger.warn({ cat, value: scores[cat] }, 'reviewNlp: invalid category score')
        return null
      }
    }

    await setCached(cacheKey, JSON.stringify(scores), { ttlDays: 365 })
    return scores
  } catch (err) {
    logger.warn({ err: err.message }, 'reviewNlp: extraction failed')
    return null
  }
}
