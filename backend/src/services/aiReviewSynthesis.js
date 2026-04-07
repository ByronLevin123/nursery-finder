// Synthesize published parent reviews into 3 balanced sections.
// 7-day TTL cache. Returns null if fewer than 3 reviews.

import db from '../db.js'
import { callClaude } from './claudeApi.js'
import { getCached, setCached } from './aiCache.js'
import { logger } from '../logger.js'

const SYSTEM_PROMPT =
  'You summarize UK parent reviews of nurseries. Be balanced and factual. ' +
  'Do not add opinions not in the reviews. Respond with valid JSON only — no prose, no markdown fences. ' +
  'Schema: {"loves": string[], "concerns": string[], "know": string[]}. ' +
  'Each array contains 2-5 short bullet strings.'

function safeParseJson(text) {
  if (!text) return null
  let cleaned = text.trim()
  // strip ```json fences if model added them anyway
  cleaned = cleaned
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (
      parsed &&
      Array.isArray(parsed.loves) &&
      Array.isArray(parsed.concerns) &&
      Array.isArray(parsed.know)
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export async function getReviewSynthesis(urn) {
  const cacheKey = `reviews_synthesis:${urn}`
  const cached = await getCached(cacheKey)
  if (cached) {
    const parsed = safeParseJson(cached.content)
    if (parsed) return parsed
  }

  if (!db) return null
  const { data: reviews, error } = await db
    .from('nursery_reviews')
    .select('rating, title, body, would_recommend')
    .eq('urn', urn)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error || !reviews || reviews.length < 3) return null

  const compact = reviews.map((r) => ({
    r: r.rating,
    rec: r.would_recommend,
    t: r.title,
    b: r.body,
  }))

  const prompt =
    'Summarize these parent reviews into the JSON schema described. ' +
    'Reviews:\n' +
    JSON.stringify(compact)

  const text = await callClaude({ prompt, system: SYSTEM_PROMPT, maxTokens: 600 })
  const parsed = safeParseJson(text)
  if (!parsed) {
    logger.warn({ urn }, 'ai review synthesis: failed to parse JSON')
    return null
  }

  await setCached(cacheKey, JSON.stringify(parsed), {
    ttlDays: 7,
    metadata: { model: 'claude-haiku-4-5', urn, reviewCount: reviews.length },
  })
  logger.info({ urn, reviewCount: reviews.length }, 'ai review synthesis generated')
  return parsed
}
